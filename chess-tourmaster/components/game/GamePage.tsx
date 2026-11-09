'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import type { ModalType } from '@/lib/game/types';
import {
  gameReducer,
  initialGameState,
  canMoveToKing,
  isStuck,
  isKingAccessExhausted,
} from '@/lib/game/gameReducer';
import { getFixedLevelConfig, MAX_LEVELS } from '@/lib/game/levelCatalog';
import {
  initSound,
  playMove,
  playVictory,
  playBurn,
  speak,
  cancelSpeak,
} from '@/lib/sound';
import PortalButton from './PortalButton';
import GameHeader, { TilesAndScoreBar } from './GameHeader';
import Board from './Board';
import MainModal from './MainModal';
import { getPortalApiBase } from '@/lib/apiBase';
import { gameFetch } from '@/lib/portal-session';
import { GameSessionClient, GameServiceError } from '@/lib/game/sessionClient';
import { useGameClock } from '@/hooks/useGameClock';
import { useGameInventory } from '@/hooks/useGameInventory';
import type { Assets } from '@/lib/portal-client';

type WinData = {
  level: number;
  time: string;
  stars: number;
  isFinalLevel: boolean;
  isNewHighScore?: boolean;
  baseScore?: number;
};

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
type LeaderboardEntry = {
  portal_user_id: number;
  rank: number;
  username: string;
  total_levels: number;
};
type PortalAssets = {
  coins: number;
  diamonds: number;
  flowers: number;
};
type LeaderboardMode = 'classic' | 'math_tour';
type ExchangeType = 'hint' | 'undo';
const HINT_ITEM_ID = 'chess_tourmaster_hint';

const UNDO_ITEM_ID = 'chess_tourmaster_undo';
export default function GamePage({ accountId, username, initialPortalAssets, portalLocale }: Props) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const activeMode = useRef(state.gameMode);
  activeMode.current = state.gameMode;
  const [modalType, setModalType] = useState<ModalType>('mode');
  const [winData, setWinData] = useState<WinData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('classic');
  const [localHintCount, setLocalHintCount] = useState(0);
  const [localUndoCount, setLocalUndoCount] = useState(0);
  const [hintLoading, setHintLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [hintConfirmOpen, setHintConfirmOpen] = useState(false);
  const [hintConfirmLoading, setHintConfirmLoading] = useState(false);
  const [hintConfirmSubmitting, setHintConfirmSubmitting] = useState(false);
  const [exchangeType, setExchangeType] = useState<ExchangeType>('hint');
  const [portalAssets, setPortalAssets] = useState<PortalAssets | null>(initialPortalAssets ?? null);
  const [hintConfirmError, setHintConfirmError] = useState<string | null>(null);
  const [hintTarget, setHintTarget] = useState<{ r: number; c: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; className: string } | null>(null);
  const [shake, setShake] = useState(false);
  const session = useRef(new GameSessionClient());
  const operationBusy = useRef(false);
  const [starting, setStarting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const paused = modalType !== 'none' || hintConfirmOpen || hintLoading || undoLoading || starting || hidden;
  const lastSpokenSecondRef = useRef<number>(4);
  const wonByCaptureRef = useRef(false);
  const portalBase = getPortalApiBase();
  const updateInventoryCounts = useCallback((counts: { hint_count: number; undo_count: number }) => {
    setLocalHintCount(counts.hint_count);
    setLocalUndoCount(counts.undo_count);
  }, []);
  const { client: portal, buy: buyGameItem, use: consumeGameItem } = useGameInventory(portalBase, accountId, updateInventoryCounts);
  const hintCount = localHintCount;
  const undoCount = localUndoCount;
  const [exchangeCost, setExchangeCost] = useState<Assets | null>(null);
  const exchangeBusy = useRef(false);
  const loadExchange = useCallback(async (kind: ExchangeType) => {
    setExchangeType(kind);
    setHintConfirmOpen(true);
    setHintConfirmLoading(true);
    setHintConfirmError(null);
    setExchangeCost(null);
    try {
      await portal.assertAccount();
      const [assets, catalog] = await Promise.all([portal.assets(), portal.catalog()]);
      const item = catalog.items[kind === 'undo' ? UNDO_ITEM_ID : HINT_ITEM_ID];
      if (!item) throw new Error('Item configuration error.');
      setPortalAssets(assets);
      setExchangeCost(item.cost);
    } catch {
      setPortalAssets(null);
      setHintConfirmError('Failed to load assets.');
    } finally { setHintConfirmLoading(false); }
  }, [portal]);

  const loadProgress = useCallback(async (mode: 'classic' | 'math_tour') => {
    if (!accountId) return null;
    try {
      const [progressRes, statsRes] = await Promise.all([
        gameFetch(`/api/progress/load?game_mode=${mode}`),
        gameFetch(`/api/levels/stats?game_mode=${mode}`),
      ]);

      const progressData = await progressRes.json();
      if (activeMode.current !== mode) return null;
      if (progressData.success && progressData.data?.total_levels != null) {
        dispatch({
          type: 'SET_MAX_UNLOCKED_LEVEL',
          payload: normalizeUnlockedLevel(progressData.data.total_levels),
        });
      }
      if (progressData.success && typeof progressData.data?.hint_count === 'number') {
        setLocalHintCount(Math.max(0, Math.floor(progressData.data.hint_count)));
      }
      if (progressData.success && typeof progressData.data?.undo_count === 'number') {
        setLocalUndoCount(Math.max(0, Math.floor(progressData.data.undo_count)));
      }

      const statsData = await statsRes.json();
      if (activeMode.current !== mode) return null;
      if (statsData.success && Array.isArray(statsData.data?.levels)) {
        const starsMap: Record<number, number> = {};
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
        }
        dispatch({ type: 'SET_LEVEL_STARS', payload: starsMap });
      }

      return progressData.data;
    } catch {
      return null;
    }
  }, [accountId]);

  const loadLeaderboard = useCallback(async (mode: LeaderboardMode) => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const res = await gameFetch(`/api/leaderboard?sort=levels&mode=${mode}&limit=10`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.success || !Array.isArray(data.data)) throw new Error('leaderboard_failed');
      const parsed = data.data
        .filter(
          (item: unknown): item is { portal_user_id: number; username: string; rank?: unknown; total_levels?: unknown } =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as { username?: unknown }).username === 'string'
        )
        .map((item: { portal_user_id: number; username: string; rank?: unknown; total_levels?: unknown }, index: number) => ({
          portal_user_id: item.portal_user_id,
          rank: typeof item.rank === 'number' ? item.rank : index + 1,
          username: item.username,
          total_levels: typeof item.total_levels === 'number' ? Math.max(0, Math.floor(item.total_levels)) : 0,
        }));
      setLeaderboard(parsed);
    } catch {
      setLeaderboard([]);
      setLeaderboardError('Could not load leaderboard. Please try again.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

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
    if (modalType !== 'mode' && modalType !== 'leaderboard') return;
    loadLeaderboard(leaderboardMode);
  }, [modalType, leaderboardMode, loadLeaderboard]);

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
  useGameClock(state.gameStartTime, state.isPlaying && !paused,
    `${state.knightPos.r},${state.knightPos.c}`, onFire, (seconds, remaining) => {
      if (seconds !== state.gameTimeSeconds) dispatch({ type: 'SET_GAME_TIME', payload: seconds });
      if (!state.isPlaying || paused) { cancelSpeak(); return; }
      if (!onFire) { lastSpokenSecondRef.current = 4; return; }
      const countdown = Math.ceil(remaining / 1000);
      if (countdown >= 1 && countdown <= 3 && countdown !== lastSpokenSecondRef.current) {
        lastSpokenSecondRef.current = countdown;
        speak(String(countdown));
      }
      if (remaining <= 0) {
        playBurn();
        setModalType('lose');
        dispatch({ type: 'LOSE_LEVEL' });
      }
    });

  // Stuck check after move / no remaining king approach tiles
  const unwinnable = state.isPlaying && state.grid.length > 0 && (isStuck(state) || isKingAccessExhausted(state));
  useEffect(() => {
    if (paused) return;
    if (unwinnable) {
      const t = setTimeout(() => {
        setModalType('lose');
        dispatch({ type: 'LOSE_LEVEL' });
      }, 500);
      return () => clearTimeout(t);
    }
  }, [paused, unwinnable]);

  const handleMove = useCallback(
    (r: number, c: number) => {
      if (!state.isPlaying || paused || operationBusy.current) return;
      setHintTarget(null);
      const tile = state.grid[r]?.[c];
      if (!tile || tile.type === 'void' || tile.visited) return;
      if (tile.type === 'king') {
        if (!canMoveToKing(state)) {
          const text =
            state.gameMode === 'math_tour'
              ? `Need ${Math.max(0, state.requiredScore - state.currentScore)} more score!`
              : 'Clear all tiles first!';
          setMessage({ text, className: 'text-rose-400' });
          setTimeout(() => setMessage(null), 1500);
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
        dispatch({ type: 'MOVE', payload: { r, c } });
        playMove();
        return;
      }
      const dr = Math.abs(state.knightPos.r - r);
      const dc = Math.abs(state.knightPos.c - c);
      if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      dispatch({ type: 'MOVE', payload: { r, c } });
      playMove();
      if (state.gameMode === 'math_tour' && tile.hasFire) {
        setMessage({ text: 'Fire: Score x3!', className: 'text-orange-400' });
        setTimeout(() => setMessage(null), 1500);
      }
    },
    [state, paused]
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
      dispatch({ type: 'SET_MAX_UNLOCKED_LEVEL', payload: saved.total_levels });
      dispatch({ type: 'UPSERT_LEVEL_STAR', payload: { level: state.level, stars: saved.stars } });
      dispatch({ type: 'WIN_LEVEL' });
      setWinData({ level: state.level, time: formatTime(saved.time_seconds), stars: saved.stars,
        isFinalLevel: state.level >= MAX_LEVELS });
      setHintTarget(null);
      playVictory();
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
    async (level: number, useSaved: boolean) => {
      if (operationBusy.current) return;
      operationBusy.current = true;
      setStarting(true);
      setSaveFailed(false);
      initSound();
      try {
        await session.current.start(level, state.gameMode);
        const config = useSaved && state.savedGridConfig?.level === level
          ? state.savedGridConfig : getFixedLevelConfig(level, state.gameMode);
        wonByCaptureRef.current = false;
        dispatch({ type: 'SET_SAVED_CONFIG', payload: config });
        dispatch({ type: 'START_LEVEL', payload: config });
        setHintTarget(null);
        setMessage(null);
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
    [state.savedGridConfig, state.gameMode]
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
    if (!accountId || paused || operationBusy.current || state.history.length === 0 || !state.isPlaying) return;
    if (undoCount <= 0) {
      if (!portalBase) {
        setMessage({
          text: 'No undos left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return;
      }
      await loadExchange('undo');
      return;
    }
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
  }, [paused, portalBase, state.history.length, state.isPlaying, accountId, undoCount, loadExchange, consumeGameItem]);

  const setMode = useCallback((mode: 'classic' | 'math_tour') => {
    if (operationBusy.current) return;
    activeMode.current = mode;
    dispatch({ type: 'SET_MODE', payload: mode });
    setHintTarget(null);
    setModalType('welcome');
  }, []);

  const handleSelectLevel = useCallback(
    (selectedLevel: number) => {
      if (operationBusy.current || saveFailed) return;
      const level = Math.max(1, Math.min(MAX_LEVELS, Math.floor(selectedLevel)));
      if (level > state.maxUnlockedLevel || level === state.level) return;
      dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
      startLevel(level, false);
    },
    [state.level, state.maxUnlockedLevel, startLevel, saveFailed]
  );

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

  const openHintExchangeDialog = useCallback(() => loadExchange('hint'), [loadExchange]);

  const handleHint = useCallback(async () => {
    if (!accountId || !state.isPlaying || paused || operationBusy.current) return;
    const result = await executeHint();
    if (result === 'need_exchange') {
      if (!portalBase) {
        setMessage({
          text: 'No hints left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return;
      }
      setExchangeType('hint');
      await openHintExchangeDialog();
      return;
    }

  }, [executeHint, paused, openHintExchangeDialog, portalBase, state.isPlaying, accountId]);

  const confirmHintExchange = useCallback(async () => {
    if (exchangeBusy.current || hintConfirmSubmitting || hintConfirmLoading || !exchangeCost || !accountId) return;
    exchangeBusy.current = true;
    setHintConfirmSubmitting(true);
    setHintConfirmError(null);
    try {
      const result = await buyGameItem(exchangeType === 'undo' ? UNDO_ITEM_ID : HINT_ITEM_ID);
      setPortalAssets(result.assets);
      setHintConfirmOpen(false);
    } catch (error) {
      setHintConfirmError(error instanceof Error ? error.message : 'Exchange failed.');
    } finally {
      exchangeBusy.current = false;
      setHintConfirmSubmitting(false);
    }
  }, [buyGameItem, exchangeType, exchangeCost, hintConfirmLoading, hintConfirmSubmitting, accountId]);

  const isHomeView = modalType === 'mode';

  return (
    <div
      className={`game-root min-h-[100dvh] w-screen flex flex-col items-center justify-start md:justify-center relative overflow-hidden ${state.theme}`}
    >
      <PortalButton
        portalLocale={portalLocale}
        isHomeView={isHomeView}
        onBackHome={() => {
          if (operationBusy.current || saveFailed) return;
          setModalType('mode');
        }}
      />

      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="theme-blob w-96 h-96 bg-cyan-500 top-0 left-0" />
        <div className="theme-blob w-96 h-96 bg-purple-500 bottom-0 right-0 animation-delay-2000" />
      </div>

      {modalType === 'none' && (
        <>
          <GameHeader
            gameMode={state.gameMode}
            level={state.level}
            maxUnlockedLevel={state.maxUnlockedLevel}
            levelStars={state.levelStars}
            username={username}
            onSelectLevel={handleSelectLevel}
            onRestart={restartLevel}
            onUndo={undoMove}
            canUndo={state.history.length > 0 && state.isPlaying}
            undoCount={undoCount}
            undoLoading={undoLoading}
            onHint={handleHint}
            hintCount={hintCount}
            hintLoading={hintLoading}
            onSettings={() => setModalType('settings')}
            onHelp={() => setModalType('help')}
          />
          <TilesAndScoreBar
            tilesLeft={state.tilesLeft}
            gameTimeSeconds={state.gameTimeSeconds}
            gameMode={state.gameMode}
            currentScore={state.currentScore}
            requiredScore={state.requiredScore}
            history={state.history}
          />
          <Board state={state} onMove={handleMove} shake={shake} hintTarget={hintTarget} locked={paused} />
          {hintConfirmOpen && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900/95 p-5 text-white shadow-2xl">
                <h3 className="text-xl font-bold mb-2">{exchangeType === 'undo' ? 'Use Undo' : 'Use Hint'}</h3>
                <p className="text-slate-300 mb-3">Cost: {exchangeCost ? Object.entries(exchangeCost).filter(([, value]) => value > 0).map(([asset, value]) => String(value) + ' ' + asset).join(', ') : '—'}</p>
                {hintConfirmLoading ? (
                  <p className="text-slate-300">Loading assets...</p>
                ) : (
                  <div className="space-y-1 text-sm text-slate-200 mb-3">
                    <p>Coins: {portalAssets?.coins ?? '-'}</p>
                    <p>Diamonds: {portalAssets?.diamonds ?? '-'}</p>
                    <p>Flowers: {portalAssets?.flowers ?? '-'}</p>
                  </div>
                )}
                {hintConfirmError && <p className="text-rose-300 text-sm mb-3">{hintConfirmError}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={hintConfirmSubmitting}
                    onClick={() => setHintConfirmOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-500 bg-slate-700/80 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmHintExchange}
                    disabled={hintConfirmLoading || hintConfirmSubmitting || !exchangeCost}
                    className="px-4 py-2 rounded-lg border border-amber-500 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hintConfirmSubmitting ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="z-10 mt-4 text-center text-gray-400 text-xs">
        <p>
          Goal:{' '}
          {state.gameMode === 'math_tour'
            ? 'Collect score → Capture '
            : 'Clear board → Capture '}
          <span className="text-rose-500 font-bold">King</span>
        </p>
      </div>

      {starting && <div role="status" className="fixed top-4 z-[80] rounded-lg bg-slate-900 px-4 py-2 text-white">Connecting…</div>}
      {message && !saveFailed && (
        <div role="status" className={`fixed bottom-6 z-[80] max-w-lg rounded-lg bg-slate-900 px-4 py-3 text-center text-sm pointer-events-none ${message.className}`}>
          {message.text}
        </div>
      )}
      {saveFailed && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6">
          <div role="alert" className="rounded-xl bg-slate-900 border border-slate-600 p-6 text-center text-white">
            <p>Your win has not been saved. Retry to keep your progress.</p>
            <button type="button" disabled={starting} onClick={() => void handleWin()}
              className="mt-4 rounded-lg bg-amber-700 px-5 py-2 disabled:opacity-50">Retry saving</button>
          </div>
        </div>
      )}
      <MainModal
        busy={starting}
        type={modalType}
        gameMode={state.gameMode}
        startLevel={state.maxUnlockedLevel}
        winData={winData}
        accountId={accountId}
        leaderboard={leaderboard}
        leaderboardLoading={leaderboardLoading}
        leaderboardError={leaderboardError}
        leaderboardMode={leaderboardMode}
        onSetMode={setMode}
        onOpenLeaderboard={() => {
          setLeaderboardMode(state.gameMode);
          setModalType('leaderboard');
        }}
        onChangeLeaderboardMode={setLeaderboardMode}
        onStartLevel={() => startLevel(state.maxUnlockedLevel, false)}
        onNextLevel={nextLevel}
        onRetry={restartLevel}
        onCloseOverlay={() => setModalType(modalType === 'leaderboard' ? 'mode' : 'none')}
        onSetTheme={(name) => dispatch({ type: 'SET_THEME', payload: name })}
      />
    </div>
  );
}
