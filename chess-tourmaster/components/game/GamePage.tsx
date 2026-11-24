'use client';

import { useReducer, useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react';
import type { GameMode, ModalType } from '@/lib/game/types';
import {
  gameReducer,
  initialGameState,
  canMoveToKing,
  isStuck,
  isKingAccessExhausted,
} from '@/lib/game/gameReducer';
import { getFixedLevelConfig, MAX_LEVELS } from '@/lib/game/levelCatalog';
import { FIRE_LIMIT_MS } from '@/lib/game/rules';
import { loadGameSettings, saveGameSettings, MAX_MOVE_VOLUME } from '@/lib/game/settings';
import {
  initSound,
  setSoundEnabled,
  playMove,
  playVictory,
  playBurn,
  speak,
  cancelSpeak,
} from '@/lib/sound';
import Board from './Board';
import MainModal from './MainModal';
import HowToPlayDialog from './HowToPlayDialog';
import GameShopDialog, { UNDO_ITEM_ID } from './GameShopDialog';
import SettingsDialog from './SettingsDialog';
import ClassicResultDialog from './ClassicResultDialog';
import ModesHome from './ModesHome';
import Tour from './Tour';
import Leaderboard from './Leaderboard';
import type { ModeProgress } from './LevelMap';
import { getPortalApiBase, getPortalUrl } from '@/lib/apiBase';
import { gameFetch } from '@/lib/portal-session';
import { GameSessionClient, GameServiceError } from '@/lib/game/sessionClient';
import { useGameClock } from '@/hooks/useGameClock';
import { useGameInventory } from '@/hooks/useGameInventory';
import type { Assets } from '@/lib/portal-client';

type WinData = {
  level: number;
  time: string;
  stars: number;
  final: boolean;
};

const SCORCH_DURATION_MS = 420;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function normalizeUnlockedLevel(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(MAX_LEVELS, Math.floor(value)));
}

function normalizeStars(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(3, Math.floor(value)));
}

type Props = {
  accountId: number;
  username: string;
  locale?: string | null;
  portalLocale?: 'en' | 'zn';
  initialPortalAssets: { coins: number; diamonds: number; flowers: number } | null;
};
type PortalAssets = {
  coins: number;
  diamonds: number;
  flowers: number;
};
export default function GamePage({ accountId, username, initialPortalAssets, portalLocale }: Props) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const activeMode = useRef(state.gameMode);
  useLayoutEffect(() => {
    activeMode.current = state.gameMode;
  }, [state.gameMode]);
  const [modalType, setModalType] = useState<ModalType>('mode');
  const [settings, setSettings] = useState(loadGameSettings);
  const moveVolume = settings.volume / MAX_MOVE_VOLUME;
  const victoryVolume = useRef(moveVolume);
  useLayoutEffect(() => { setSoundEnabled(settings.sound); }, [settings.sound]);
  const [homeOverlay, setHomeOverlay] = useState(false);
  const [mapHelpMode, setMapHelpMode] = useState<GameMode>();
  const [initialMapMode, setInitialMapMode] = useState<GameMode>();
  const [modeProgress, setModeProgress] = useState<Partial<Record<GameMode, ModeProgress>>>({});
  const [winData, setWinData] = useState<WinData | null>(null);
  const [classicBestTimes, setClassicBestTimes] = useState<Record<number, number>>({});
  const [burned, setBurned] = useState(false);
  const [fireFrame, setFireFrame] = useState<{ position: string; remainingMs: number } | null>(null);
  const leaderboardButton = useRef<HTMLButtonElement>(null);
  const [localHintCount, setLocalHintCount] = useState(0);
  const [localUndoCount, setLocalUndoCount] = useState(0);
  const [hintLoading, setHintLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [portalAssets, setPortalAssets] = useState<PortalAssets | null>(initialPortalAssets ?? null);
  const assetsRevision = useRef(0);
  const [hintTarget, setHintTarget] = useState<{ r: number; c: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; className: string } | null>(null);
  const [shake, setShake] = useState(false);
  const session = useRef(new GameSessionClient());
  const operationBusy = useRef(false);
  const [starting, setStarting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const gameBusy = modalType !== 'none' || hintLoading || undoLoading || starting || hidden;
  const paused = gameBusy || shopOpen;
  const lastSpokenSecondRef = useRef<number>(4);
  const wonByCaptureRef = useRef(false);
  const portalBase = getPortalApiBase();
  const updateInventoryCounts = useCallback((counts: { hint_count: number; undo_count: number }) => {
    setLocalHintCount(counts.hint_count);
    setLocalUndoCount(counts.undo_count);
  }, []);
  const { client: portal, buy: buyGameItem, use: consumeGameItem } = useGameInventory(portalBase, accountId, updateInventoryCounts);
  const applyPortalAssets = useCallback((assets: Assets) => {
    assetsRevision.current += 1;
    setPortalAssets(assets);
  }, []);

  useEffect(() => {
    let pending: AbortController | undefined;
    const refreshAssets = () => {
      if (document.hidden || pending) return;
      const controller = new AbortController();
      pending = controller;
      const revision = assetsRevision.current;
      void portal.accountAssets(controller.signal).then(assets => {
        if (!controller.signal.aborted && revision === assetsRevision.current) applyPortalAssets(assets);
      }).catch(() => {
        // Keep the last balance if the Portal session or connection is temporarily unavailable.
      }).finally(() => {
        if (pending === controller) pending = undefined;
      });
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        pending?.abort();
        pending = undefined;
      } else {
        refreshAssets();
      }
    };
    refreshAssets();
    window.addEventListener('focus', refreshAssets);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshAssets);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      pending?.abort();
    };
  }, [portal, applyPortalAssets]);

  const hintCount = localHintCount;
  const undoCount = localUndoCount;
  const loadShop = useCallback(async (signal: AbortSignal) => {
    const [assets, catalog] = await Promise.all([portal.accountAssets(signal), portal.catalog(signal)]);
    if (!signal.aborted) applyPortalAssets(assets);
    return catalog.items;
  }, [portal, applyPortalAssets]);
  const buyShopItem = useCallback(async (sku: string) => {
    const purchase = await buyGameItem(sku);
    applyPortalAssets(purchase.assets);
  }, [buyGameItem, applyPortalAssets]);

  const loadProgress = useCallback(async (mode: GameMode, applyToGame = true) => {
    if (!accountId) return null;
    try {
      const [progressRes, statsRes] = await Promise.all([
        gameFetch(`/api/progress/load?game_mode=${mode}`),
        gameFetch(`/api/levels/stats?game_mode=${mode}`),
      ]);

      const progressData = await progressRes.json();
      const applyProgress = applyToGame && activeMode.current === mode;
      const unlocked = normalizeUnlockedLevel(progressData.data?.total_levels);
      if (applyProgress && progressData.success && typeof progressData.data?.hint_count === 'number') {
        setLocalHintCount(Math.max(0, Math.floor(progressData.data.hint_count)));
      }
      if (applyProgress && progressData.success && typeof progressData.data?.undo_count === 'number') {
        setLocalUndoCount(Math.max(0, Math.floor(progressData.data.undo_count)));
      }

      const statsData = await statsRes.json();
      if (statsData.success && Array.isArray(statsData.data?.levels)) {
        const starsMap: Record<number, number> = {};
        const bestTimes: Record<number, number> = {};
        for (const item of statsData.data.levels) {
          if (!item || typeof item.level !== 'number') continue;
          const bestStars = normalizeStars(
            typeof item.best_stars === 'number'
              ? item.best_stars
              : typeof item.total_stars === 'number'
                ? item.total_stars
                : item.stars
          );
          starsMap[item.level] = Math.max(starsMap[item.level] ?? 0, bestStars);
          if (mode === 'classic' && Number.isFinite(item.best_time) && item.best_time >= 0) {
            bestTimes[item.level] = Math.min(bestTimes[item.level] ?? Infinity, item.best_time);
          }
        }
        setModeProgress(previous => ({
          ...previous,
          [mode]: { unlocked: progressData.success ? unlocked : previous[mode]?.unlocked ?? 1, stars: starsMap },
        }));
        if (applyToGame && activeMode.current === mode) dispatch({ type: 'SET_LEVEL_STARS', payload: starsMap });
        if (mode === 'classic' && Object.keys(bestTimes).length > 0) {
          setClassicBestTimes(previous => {
            const merged = { ...previous };
            for (const [level, time] of Object.entries(bestTimes)) {
              merged[Number(level)] = Math.min(previous[Number(level)] ?? Infinity, time);
            }
            return merged;
          });
        }
      } else if (progressData.success) {
        setModeProgress(previous => ({ ...previous, [mode]: { unlocked, stars: previous[mode]?.stars ?? {} } }));
      }

      return progressData.data;
    } catch {
      return null;
    }
  }, [accountId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) {
        await loadProgress(state.gameMode);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [loadProgress, state.gameMode]);

  useEffect(() => {
    if (modalType !== 'mode') return;
    void Promise.resolve().then(() => loadProgress(state.gameMode === 'classic' ? 'math_tour' : 'classic', false));
  }, [loadProgress, modalType, state.gameMode]);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!session.current.id || starting) return;
    void session.current.transition(state.isPlaying && !paused ? 'resume' : 'pause').catch(() => {
      setMessage({ text: 'Could not sync game timer. Check your connection.', className: 'text-rose-300' });
    });
  }, [paused, state.isPlaying, state.gameStartTime, starting]);

  const onFire = Boolean(state.grid[state.knightPos.r]?.[state.knightPos.c]?.hasFire);
  const position = `${state.knightPos.r},${state.knightPos.c}`;
  useGameClock(state.gameStartTime, state.isPlaying && !paused, position, onFire,
    (seconds, remaining) => {
      if (seconds !== state.gameTimeSeconds) dispatch({ type: 'SET_GAME_TIME', payload: seconds });
      if (onFire && state.isPlaying) {
        setFireFrame(frame => frame?.position === position && frame.remainingMs === remaining
          ? frame : { position, remainingMs: remaining });
      } else if (!onFire) {
        setFireFrame(null);
      }
      if (!state.isPlaying || paused) { cancelSpeak(); return; }
      if (!onFire) {
        if (lastSpokenSecondRef.current !== 4) cancelSpeak();
        lastSpokenSecondRef.current = 4;
        return;
      }
      const countdown = Math.ceil(remaining / 1000);
      if (countdown >= 1 && countdown <= 3 && countdown !== lastSpokenSecondRef.current) {
        lastSpokenSecondRef.current = countdown;
        speak(String(countdown));
      }
      if (remaining <= 0) {
        playBurn();
        setMessage(null);
        setBurned(true);
        setModalType('scorch');
        dispatch({ type: 'LOSE_LEVEL' });
      }
    });

  useEffect(() => {
    if (modalType !== 'scorch') return;
    const timer = window.setTimeout(() => setModalType('lose'), SCORCH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [modalType]);

  // Stuck check after move / no remaining king approach tiles
  const unwinnable = state.isPlaying && !onFire && state.grid.length > 0 && (isStuck(state) || isKingAccessExhausted(state));
  useLayoutEffect(() => {
    if (paused) return;
    if (unwinnable) {
      const t = setTimeout(() => {
        setMessage(null);
        setBurned(false);
        setModalType('lose');
        dispatch({ type: 'LOSE_LEVEL' });
      }, 500);
      return () => clearTimeout(t);
    }
  }, [paused, unwinnable]);

  const handleMove = useCallback(
    (r: number, c: number) => {
      if (!state.isPlaying || paused || operationBusy.current) return;
      if (state.gameMode !== 'classic') setHintTarget(null);
      const tile = state.grid[r]?.[c];
      if (!tile || tile.type === 'void' || tile.visited) return;
      if (tile.type === 'king') {
        if (!canMoveToKing(state)) {
          const text =
            state.gameMode === 'math_tour'
              ? `Need ${Math.max(0, state.requiredScore - state.currentScore)} more score!`
              : 'Clear all tiles first!';
          const notice = { text, className: 'text-rose-400' };
          setMessage(notice);
          setTimeout(() => setMessage(current => current === notice ? null : current), 1500);
          setShake(true);
          setTimeout(() => setShake(false), 500);
          return;
        }
        const dr = Math.abs(state.knightPos.r - r);
        const dc = Math.abs(state.knightPos.c - c);
        if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          return;
        }
        setHintTarget(null);
        dispatch({ type: 'MOVE', payload: { r, c } });
        playMove(moveVolume);
        return;
      }
      const dr = Math.abs(state.knightPos.r - r);
      const dc = Math.abs(state.knightPos.c - c);
      if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      setHintTarget(null);
      dispatch({ type: 'MOVE', payload: { r, c } });
      playMove(moveVolume);
      if (state.gameMode === 'math_tour' && tile.hasFire) {
        const notice = { text: 'Fire: Score x3!', className: 'text-orange-400' };
        setMessage(notice);
        setTimeout(() => setMessage(current => current === notice ? null : current), 1500);
      }
    },
    [state, paused, moveVolume]
  );

  const handleWin = useCallback(async () => {
    if (operationBusy.current) return;
    operationBusy.current = true;
    setStarting(true);
    setSaveFailed(false);
    try {
      await session.current.transition('pause');
      const saved = await session.current.finish(state.history.map(entry => entry.prevPos));
      updateInventoryCounts(saved);
      dispatch({ type: 'UPSERT_LEVEL_STAR', payload: { level: state.level, stars: saved.stars } });
      setModeProgress(previous => ({
        ...previous,
        [state.gameMode]: {
          unlocked: saved.total_levels,
          stars: { ...state.levelStars, [state.level]: Math.max(state.levelStars[state.level] ?? 0, saved.stars) },
        },
      }));
      dispatch({ type: 'WIN_LEVEL' });
      setWinData({ level: state.level, time: formatTime(saved.time_seconds), stars: saved.stars,
        final: state.level >= MAX_LEVELS });
      if (state.gameMode === 'classic') {
        setClassicBestTimes(previous => ({
          ...previous,
          [state.level]: Math.min(previous[state.level] ?? Infinity, saved.time_seconds),
        }));
      }
      setHintTarget(null);
      setMessage(null);
      playVictory(victoryVolume.current);
      setModalType('win');
    } catch {
      setSaveFailed(true);
      setMessage({ text: 'Could not save your win. Retry to save progress.', className: 'text-rose-300' });
    } finally {
      operationBusy.current = false;
      setStarting(false);
    }
  }, [state, updateInventoryCounts]);

  useEffect(() => {
    if (!state.isPlaying && state.grid.length > 0 && state.knightPos.r === state.kingPos.r
      && state.knightPos.c === state.kingPos.c && !wonByCaptureRef.current) {
      wonByCaptureRef.current = true;
      void handleWin();
    }
  }, [state, handleWin]);

  const startLevel = useCallback(
    async (requestedLevel: number | undefined, useSaved: boolean, mode = state.gameMode) => {
      if (operationBusy.current) return;
      operationBusy.current = true;
      setStarting(true);
      setSaveFailed(false);
      setMessage(null);
      initSound();
      try {
        const unlocked = requestedLevel ?? (await loadProgress(mode, false))?.total_levels;
        if (typeof unlocked !== 'number') throw new Error('progress_unavailable');
        const level = normalizeUnlockedLevel(unlocked);
        await session.current.start(level, mode);
        const config = useSaved && state.savedGridConfig?.level === level
          ? state.savedGridConfig : getFixedLevelConfig(level, mode);
        if (mode !== state.gameMode) {
          dispatch({ type: 'SET_MODE', payload: mode });
        }
        wonByCaptureRef.current = false;
        lastSpokenSecondRef.current = 4;
        setBurned(false);
        setFireFrame(null);
        dispatch({ type: 'SET_SAVED_CONFIG', payload: config });
        dispatch({ type: 'START_LEVEL', payload: config });
        setHintTarget(null);
        setMessage(null);
        setInitialMapMode(undefined);
        setModalType('none');
      } catch (error) {
        setMessage({ text: error instanceof GameServiceError && error.code === 'VERSION_MISMATCH'
          ? 'The game has been updated. Refresh to load the latest levels.'
          : 'Could not start level. Please try again.', className: 'text-rose-300' });
      } finally {
        operationBusy.current = false;
        setStarting(false);
      }
    },
    [loadProgress, state.savedGridConfig, state.gameMode]
  );

  const nextLevel = useCallback(() => {
    if (operationBusy.current) return;
    if (state.level >= MAX_LEVELS) {
      dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
      setModalType('mode');
      return;
    }
    dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
    startLevel(state.level + 1, false);
  }, [state.level, startLevel]);

  const restartLevel = useCallback(() => {
    if (saveFailed) return;
    void startLevel(state.level, true);
  }, [state.level, startLevel, saveFailed]);

  const undoMove = useCallback(async () => {
    if (!accountId || paused || operationBusy.current || !state.isPlaying) return;
    if (undoCount <= 0) {
      if (!portalBase) {
        setMessage({
          text: 'No undos left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return;
      }
      setShopOpen(true);
      return;
    }
    if (state.history.length === 0) return;
    setUndoLoading(true);
    operationBusy.current = true;
    try {
      await session.current.transition('pause');
      const used = await consumeGameItem(UNDO_ITEM_ID, async () => {
        const response = await gameFetch('/api/undo/use', {
          method: 'POST',
        });
        const data = await response.json().catch(() => null);
        if (typeof data?.data?.undo_count === 'number') setLocalUndoCount(data.data.undo_count);
        if (data?.code === 'NO_UNDO_LEFT' && portalBase) setShopOpen(true);
        return response.ok && data?.success === true;
      });
      if (!used) return;
      wonByCaptureRef.current = false;
      setHintTarget(null);
      dispatch({ type: 'UNDO' });
    } catch {
      setMessage({
        text: 'Undo service unavailable.',
        className: 'text-rose-300',
      });
      setTimeout(() => setMessage(null), 1800);
    } finally {
      operationBusy.current = false;
      setUndoLoading(false);
    }
  }, [paused, portalBase, state.history.length, state.isPlaying, accountId, undoCount, consumeGameItem]);

  const executeHint = useCallback(async (): Promise<'used' | 'need_exchange' | 'failed'> => {
    if (!accountId || !state.isPlaying || paused || operationBusy.current) return 'failed';
    operationBusy.current = true;
    setHintLoading(true);
    try {
      await session.current.transition('pause');
      const hint = await session.current.hint(state.history.map(entry => entry.prevPos));
      setLocalHintCount(hint.hint_count);
      setHintTarget(hint.move);
      return 'used';
    } catch (error) {
      if (error instanceof GameServiceError && error.code === 'NO_HINT_LEFT') return 'need_exchange';
      setHintTarget(null);
      setMessage({
        text: error instanceof GameServiceError && error.code === 'NO_WIN_PATH'
          ? 'No winning route remains. Undo or restart. No hint used.'
          : error instanceof GameServiceError && error.code === 'SEARCH_EXHAUSTED'
            ? 'Could not verify a winning route. No hint used.' : 'Hint service unavailable. Retry safely.',
        className: 'text-rose-300',
      });
      setTimeout(() => setMessage(null), 2000);
      return 'failed';
    } finally {
      operationBusy.current = false;
      setHintLoading(false);
    }
  }, [paused, state, accountId]);

  const handleHint = useCallback(async () => {
    if (!accountId || !state.isPlaying || paused || operationBusy.current) return;
    if (hintCount > 0 && await executeHint() !== 'need_exchange') return;
    if (portalBase) {
      setShopOpen(true);
    } else {
      setMessage({ text: 'No hints left.', className: 'text-amber-300' });
      setTimeout(() => setMessage(null), 1800);
    }
  }, [executeHint, hintCount, paused, portalBase, state.isPlaying, accountId]);

  if (modalType === 'leaderboard') {
    return <Leaderboard accountId={accountId} initialMode={state.gameMode} onHome={() => {
      setModalType('mode');
      window.scrollTo(0, 0);
      window.requestAnimationFrame(() => leaderboardButton.current?.focus({ preventScroll: true }));
    }} />;
  }

  const isHomeView = modalType === 'mode' || homeOverlay;
  const fireRemaining = fireFrame?.position === position ? fireFrame.remainingMs : FIRE_LIMIT_MS;
  const fire = onFire ? { progress: burned ? 1 : 1 - fireRemaining / FIRE_LIMIT_MS, charred: burned, paused } : undefined;
  const tour = state.gameMode === 'math_tour' ? {
    mode: state.gameMode, score: state.currentScore, requiredScore: state.requiredScore, history: state.history,
  } : { mode: state.gameMode };
  const win = modalType === 'win' ? winData : null;
  const result = win ? (tour.mode === 'math_tour' ? {
    ...win, type: 'math-win' as const, score: tour.score, requiredScore: tour.requiredScore,
    history: tour.history, tilesLeft: state.tilesLeft,
  } : {
    ...win, type: 'win' as const,
    bestTime: classicBestTimes[win.level] === undefined ? win.time : formatTime(classicBestTimes[win.level]),
  }) : modalType === 'lose' ? { type: 'lose' as const, burned } : null;
  const backHome = (mapMode?: GameMode) => {
    if (operationBusy.current || saveFailed) return;
    setMessage(null);
    setInitialMapMode(mapMode);
    void loadProgress(state.gameMode);
    setModalType('mode');
    window.scrollTo(0, 0);
  };
  const openHomeOverlay = (type: 'help' | 'settings', mode?: GameMode) => {
    if (operationBusy.current) return;
    setMapHelpMode(mode);
    setHomeOverlay(true);
    setModalType(type);
  };
  const closeOverlay = () => {
    setModalType(homeOverlay ? 'mode' : 'none');
    setHomeOverlay(false);
  };

  return (
    <div className={`relative min-h-[100dvh] ${isHomeView ? '' : state.theme}`} inert={modalType === 'scorch' || undefined}>
      {isHomeView ? <ModesHome
        username={username}
        coins={portalAssets?.coins}
        shopUrl={getPortalUrl('shop', portalLocale)}
        portalUrl={getPortalUrl('braingames', portalLocale)}
        progress={modeProgress}
        initialMapMode={initialMapMode}
        onCloseMap={() => setInitialMapMode(undefined)}
        busy={starting}
        leaderboardButtonRef={leaderboardButton}
        onPlay={(mode, level) => {
          void startLevel(level ?? modeProgress[mode]?.unlocked, false, mode);
        }}
        onLeaderboard={() => {
          setModalType('leaderboard');
          window.scrollTo(0, 0);
        }}
        onMapHelp={(mode) => openHomeOverlay('help', mode)}
        onSettings={(mode) => openHomeOverlay('settings', mode)}
      /> : <Tour
        {...tour}
        level={state.level}
        tilesLeft={state.tilesLeft}
        time={settings.showTimer ? formatTime(state.gameTimeSeconds) : undefined}
        username={username}
        coins={portalAssets?.coins}
        shopUrl={getPortalUrl('shop', portalLocale)}
        themed={state.theme !== initialGameState.theme}
        busy={gameBusy}
        canUndo={state.isPlaying && (state.history.length > 0 || undoCount === 0)}
        canHint={state.isPlaying}
        undoCount={undoCount}
        hintCount={hintCount}
        hintTarget={hintTarget}
        onHome={() => backHome()}
        onMap={() => backHome(state.gameMode)}
        onSettings={() => setModalType('settings')}
        onHelp={() => setModalType('help')}
        onRestart={restartLevel}
        onUndo={undoMove}
        onHint={handleHint}
      >
        <Board state={state} onMove={handleMove} shake={shake} hintTarget={hintTarget} locked={paused}
          showNextMoves={settings.showNextMoves} fire={fire} />
      </Tour>}

      {modalType === 'none' && shopOpen && <GameShopDialog assets={portalAssets} hints={hintCount} undos={undoCount}
        load={loadShop} buy={buyShopItem} onClose={() => setShopOpen(false)} />}

      {starting && !result && <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-white">Connecting…</div>}
      <div role="status">
        {message && !saveFailed && !result && (
          <div className={`fixed bottom-6 left-1/2 z-[80] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-center text-sm pointer-events-none ${message.className}`}>
            {message.text}
          </div>
        )}
      </div>
      {saveFailed && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6">
          <div role="alert" className="rounded-xl bg-slate-900 border border-slate-600 p-6 text-center text-white">
            <p>Your win has not been saved. Retry to keep your progress.</p>
            <button type="button" disabled={starting} onClick={() => void handleWin()}
              className="mt-4 rounded-lg bg-amber-700 px-5 py-2 disabled:opacity-50">Retry saving</button>
          </div>
        </div>
      )}
      {result ? <ClassicResultDialog
        result={result}
        busy={starting}
        error={message?.text}
        onDismiss={() => { setMessage(null); setModalType('none'); }}
        onRestart={restartLevel}
        onNextLevel={nextLevel}
        onMap={() => backHome(state.gameMode)}
        onHome={() => backHome()}
      /> : modalType === 'settings' ? <SettingsDialog
        settings={settings}
        onSave={next => {
          victoryVolume.current = next.volume / MAX_MOVE_VOLUME;
          setSettings(next);
          saveGameSettings(next);
        }}
        onClose={closeOverlay}
        onRules={() => setModalType('rules')}
      /> : modalType === 'rules' ? <HowToPlayDialog
        initialMode={homeOverlay ? mapHelpMode : state.gameMode}
        onClose={closeOverlay}
      /> : modalType === 'help' && (homeOverlay ? <MainModal
        busy={starting}
        gameMode={mapHelpMode ?? state.gameMode}
        onCloseOverlay={closeOverlay}
      /> : <HowToPlayDialog gameMode={state.gameMode} onClose={closeOverlay} />)}
    </div>
  );
}
