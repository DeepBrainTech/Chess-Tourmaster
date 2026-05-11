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
import { getApiBase } from '@/lib/apiBase';
import { getHintMove } from '@/lib/game/hint';

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
  token: string | null;
  username: string;
  locale?: string | null;
  initialPortalAssets: { coins: number; diamonds: number; flowers: number } | null;
};
type LeaderboardEntry = {
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
const HINT_GAME_MODE = 'chess-tourmaster';
const PORTAL_API = 'https://api.deepbraintechnology.com';
const HINT_PRICE_COINS = 5;
const UNDO_ITEM_ID = 'chess_tourmaster_undo';
type PortalErrorCode =
  | 'insufficient_assets'
  | 'insufficient_inventory'
  | 'item_not_available_for_game'
  | 'invalid_item_id'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_REQUIRED';

function normalizeApiBase(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/\/+$/, '');
}

function extractPortalErrorCode(data: unknown): PortalErrorCode | null {
  if (typeof data !== 'object' || data === null) return null;
  const source = data as {
    detail?: unknown;
    code?: unknown;
    error_code?: unknown;
    error?: { code?: unknown } | unknown;
  };
  const nestedError =
    typeof source.error === 'object' && source.error !== null
      ? (source.error as { code?: unknown })
      : undefined;
  const raw = source.detail ?? source.code ?? source.error_code ?? nestedError?.code;
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  if (
    code === 'insufficient_assets' ||
    code === 'insufficient_inventory' ||
    code === 'item_not_available_for_game' ||
    code === 'invalid_item_id' ||
    code === 'AUTH_INVALID_TOKEN' ||
    code === 'AUTH_REQUIRED'
  ) {
    return code;
  }
  return null;
}

function getPortalErrorMessage(code: PortalErrorCode | null): string | null {
  if (!code) return null;
  switch (code) {
    case 'insufficient_assets':
      return 'Not enough coins.';
    case 'insufficient_inventory':
      return 'Hint inventory is insufficient.';
    case 'item_not_available_for_game':
      return 'This item is not available for this game.';
    case 'invalid_item_id':
      return 'Item configuration error.';
    case 'AUTH_INVALID_TOKEN':
    case 'AUTH_REQUIRED':
      return 'Session expired. Please log in again.';
    default:
      return null;
  }
}

export default function GamePage({ token, username, initialPortalAssets }: Props) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [modalType, setModalType] = useState<ModalType>('mode');
  const [winData, setWinData] = useState<WinData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('classic');
  const [hintCount, setHintCount] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
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
  const fireStartRef = useRef<number>(0);
  const lastSpokenSecondRef = useRef<number>(4);
  const wonByCaptureRef = useRef(false);
  const portalBase = normalizeApiBase(process.env.NEXT_PUBLIC_PORTAL_API_BASE || PORTAL_API);

  const loadProgress = useCallback(async (mode: 'classic' | 'math_tour') => {
    if (!token) return null;
    try {
      const [progressRes, statsRes] = await Promise.all([
        fetch(`${getApiBase()}/api/progress/load?game_mode=${mode}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getApiBase()}/api/levels/stats?game_mode=${mode}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const progressData = await progressRes.json();
      if (progressData.success && progressData.data?.total_levels != null) {
        dispatch({
          type: 'SET_MAX_UNLOCKED_LEVEL',
          payload: normalizeUnlockedLevel(progressData.data.total_levels),
        });
      }
      if (progressData.success && typeof progressData.data?.hint_count === 'number') {
        setHintCount(Math.max(0, Math.floor(progressData.data.hint_count)));
      }
      if (progressData.success && typeof progressData.data?.undo_count === 'number') {
        setUndoCount(Math.max(0, Math.floor(progressData.data.undo_count)));
      }

      const statsData = await statsRes.json();
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
  }, [token]);

  const saveProgress = useCallback(
    async (
      maxUnlockedLevel: number,
      levelData?: { level: number; moves_count: number; time_seconds: number; stars: number; game_mode: 'classic' | 'math_tour' }
    ) => {
      if (!token) return;
      try {
        await fetch(`${getApiBase()}/api/progress/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            total_levels: maxUnlockedLevel,
            level_data: levelData,
          }),
        }).then(async (res) => {
          const data = await res.json().catch(() => null);
          if (data?.success && typeof data.data?.hint_count === 'number') {
            setHintCount(Math.max(0, Math.floor(data.data.hint_count)));
          }
          if (data?.success && typeof data.data?.undo_count === 'number') {
            setUndoCount(Math.max(0, Math.floor(data.data.undo_count)));
          }
        });
      } catch (e) {
        console.error(e);
      }
    },
    [token]
  );

  const loadLeaderboard = useCallback(async (mode: LeaderboardMode) => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/leaderboard?sort=levels&mode=${mode}&limit=10`);
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.data)) {
        setLeaderboard([]);
        return;
      }
      const parsed = data.data
        .filter(
          (item: unknown): item is { username: string; rank?: unknown; total_levels?: unknown } =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as { username?: unknown }).username === 'string'
        )
        .map((item: { username: string; rank?: unknown; total_levels?: unknown }, index: number) => ({
          rank: typeof item.rank === 'number' ? item.rank : index + 1,
          username: item.username,
          total_levels: normalizeUnlockedLevel(item.total_levels),
        }));
      setLeaderboard(parsed);
    } catch {
      setLeaderboard([]);
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

  // Game timer
  useEffect(() => {
    if (!state.isPlaying) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
      dispatch({ type: 'SET_GAME_TIME', payload: elapsed });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.gameStartTime]);

  // Fire timer (3s on fire tile) + countdown voice
  useEffect(() => {
    if (!state.isPlaying || state.grid.length === 0) return;
    const tile = state.grid[state.knightPos.r]?.[state.knightPos.c];
    if (tile?.hasFire) {
      if (fireStartRef.current === 0) fireStartRef.current = Date.now();
      const interval = setInterval(() => {
        const remaining = 3000 - (Date.now() - fireStartRef.current);
        const seconds = Math.ceil(remaining / 1000);
        if (seconds >= 1 && seconds <= 3 && seconds !== lastSpokenSecondRef.current) {
          lastSpokenSecondRef.current = seconds;
          speak(seconds.toString());
        }
        if (remaining <= 0) {
          playBurn();
          setModalType('lose');
          dispatch({ type: 'LOSE_LEVEL' });
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      fireStartRef.current = 0;
      lastSpokenSecondRef.current = 4;
      cancelSpeak();
    }
  }, [state.isPlaying, state.knightPos, state.grid]);

  // Stuck check after move / no remaining king approach tiles
  useEffect(() => {
    if (!state.isPlaying || state.grid.length === 0) return;
    if (isStuck(state) || isKingAccessExhausted(state)) {
      const t = setTimeout(() => {
        setModalType('lose');
        dispatch({ type: 'LOSE_LEVEL' });
      }, 500);
      return () => clearTimeout(t);
    }
  }, [state.isPlaying, state.grid, state.knightPos, state.tilesLeft, state.history.length]);

  // Win by capture: knight moved to King (reducer set isPlaying=false), trigger win modal
  useEffect(() => {
    if (
      !state.isPlaying &&
      state.grid.length > 0 &&
      state.knightPos.r === state.kingPos.r &&
      state.knightPos.c === state.kingPos.c &&
      !wonByCaptureRef.current
    ) {
      wonByCaptureRef.current = true;
      void handleWin();
    }
  }, [state.isPlaying, state.knightPos.r, state.knightPos.c, state.kingPos.r, state.kingPos.c, state.grid.length]);

  const handleMove = useCallback(
    (r: number, c: number) => {
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
    [state]
  );

  async function handleWin() {
    playVictory();
    const elapsed = (Date.now() - state.gameStartTime) / 1000;
    let stars: number;
    if (state.gameMode === 'math_tour') {
      const r = state.requiredScore;
      const s = state.currentScore;
      if (r <= 0) stars = 3;
      else if (s >= r * 1.2) stars = 3;
      else if (s >= r * 1.08) stars = 2;
      else stars = 1;
    } else {
      stars = 1;
      if (elapsed <= state.parTime) stars = 3;
      else if (elapsed <= state.parTime * 1.5) stars = 2;
    }
    const nextUnlockedLevel = Math.min(MAX_LEVELS, Math.max(state.maxUnlockedLevel, state.level + 1));
    await saveProgress(nextUnlockedLevel, {
      level: state.level,
      moves_count: state.history.length,
      time_seconds: state.gameTimeSeconds,
      stars,
      game_mode: state.gameMode,
    });
    dispatch({ type: 'SET_MAX_UNLOCKED_LEVEL', payload: nextUnlockedLevel });
    dispatch({ type: 'UPSERT_LEVEL_STAR', payload: { level: state.level, stars } });
    dispatch({ type: 'WIN_LEVEL' });
    setWinData({
      level: state.level,
      time: formatTime(state.gameTimeSeconds),
      stars,
      isFinalLevel: state.level >= MAX_LEVELS,
    });
    setHintTarget(null);
    setModalType('win');
  }

  const startLevel = useCallback(
    (level: number, useSaved: boolean) => {
      initSound();
      wonByCaptureRef.current = false;
      let config;
      if (useSaved && state.savedGridConfig && state.savedGridConfig.level === level) {
        config = state.savedGridConfig;
      } else {
        config = getFixedLevelConfig(level, state.gameMode);
        dispatch({ type: 'SET_SAVED_CONFIG', payload: config });
      }
      dispatch({ type: 'START_LEVEL', payload: config });
      setHintTarget(null);
      setModalType('none');
    },
    [state.savedGridConfig, state.gameMode]
  );

  const nextLevel = useCallback(() => {
    if (state.level >= MAX_LEVELS) {
      dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
      setModalType('mode');
      return;
    }
    dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
    startLevel(state.level + 1, false);
  }, [state.level, startLevel]);

  const restartLevel = useCallback(() => {
    const saved = state.savedGridConfig;
    if (!saved) return;
    dispatch({ type: 'START_LEVEL', payload: saved });
    setHintTarget(null);
    setModalType('none');
  }, [state.savedGridConfig]);

  const undoMove = useCallback(async () => {
    if (!token || undoLoading || state.history.length === 0 || !state.isPlaying) return;
    if (undoCount <= 0) {
      if (!portalBase) {
        setMessage({
          text: 'No undos left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return;
      }
      setExchangeType('undo');
      setHintConfirmOpen(true);
      setHintConfirmLoading(true);
      setHintConfirmError(null);
      try {
        const res = await fetch(`${portalBase}/api/user/assets`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'X-User-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          },
        });
        const data = await res.json().catch(() => null);
        const coins = data?.data?.coins;
        const diamonds = data?.data?.diamonds;
        const flowers = data?.data?.flowers;
        if (typeof coins !== 'number' || typeof diamonds !== 'number' || typeof flowers !== 'number') {
          setPortalAssets(null);
          setHintConfirmError('Failed to load assets.');
        } else {
          setPortalAssets({
            coins: Math.max(0, Math.floor(coins)),
            diamonds: Math.max(0, Math.floor(diamonds)),
            flowers: Math.max(0, Math.floor(flowers)),
          });
        }
      } catch {
        setPortalAssets(null);
        setHintConfirmError('Failed to load assets.');
      } finally {
        setHintConfirmLoading(false);
      }
      return;
    }
    setUndoLoading(true);
    try {
      const useRes = await fetch(`${getApiBase()}/api/undo/use`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const useData = await useRes.json().catch(() => null);
      if (!useData?.success) {
        if (typeof useData?.data?.undo_count === 'number') {
          setUndoCount(Math.max(0, Math.floor(useData.data.undo_count)));
        }
        setMessage({
          text: 'No undos left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return;
      }
      if (typeof useData?.data?.undo_count === 'number') {
        setUndoCount(Math.max(0, Math.floor(useData.data.undo_count)));
      } else {
        setUndoCount(prev => Math.max(0, prev - 1));
      }
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
      setUndoLoading(false);
    }
  }, [portalBase, state.history.length, state.isPlaying, token, undoCount, undoLoading]);

  const setMode = useCallback((mode: 'classic' | 'math_tour') => {
    dispatch({ type: 'SET_MODE', payload: mode });
    setHintTarget(null);
    loadProgress(mode);
    setModalType('welcome');
  }, [loadProgress]);

  const handleSelectLevel = useCallback(
    (selectedLevel: number) => {
      const level = Math.max(1, Math.min(MAX_LEVELS, Math.floor(selectedLevel)));
      if (level > state.maxUnlockedLevel || level === state.level) return;
      dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
      startLevel(level, false);
    },
    [state.level, state.maxUnlockedLevel, startLevel]
  );

  const getPortalAssets = useCallback(async () => {
    if (!portalBase) return null;
    const res = await fetch(`${portalBase}/api/user/assets`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-User-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
    });
    const data = await res.json().catch(() => null);
    const coins = data?.data?.coins;
    const diamonds = data?.data?.diamonds;
    const flowers = data?.data?.flowers;
    if (typeof coins !== 'number' || typeof diamonds !== 'number' || typeof flowers !== 'number') return null;
    return {
      coins: Math.max(0, Math.floor(coins)),
      diamonds: Math.max(0, Math.floor(diamonds)),
      flowers: Math.max(0, Math.floor(flowers)),
    };
  }, [portalBase]);

  const executeHint = useCallback(async (): Promise<'used' | 'need_exchange' | 'failed'> => {
    if (!token || !state.isPlaying || hintLoading || hintConfirmSubmitting) return 'failed';
    setHintLoading(true);
    try {
      const consumeRes = await fetch(`${getApiBase()}/api/hint/use`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const consumeData = await consumeRes.json().catch(() => null);
      if (!consumeData?.success) {
        if (typeof consumeData?.data?.hint_count === 'number') {
          setHintCount(Math.max(0, Math.floor(consumeData.data.hint_count)));
        }
        setMessage({
          text: 'No hints left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return 'need_exchange';
      }

      if (typeof consumeData?.data?.hint_count === 'number') {
        setHintCount(Math.max(0, Math.floor(consumeData.data.hint_count)));
      } else {
        setHintCount(prev => Math.max(0, prev - 1));
      }

      const hint = getHintMove(state);
      if (hint.type === 'next_move') {
        setHintTarget(hint.move);
      } else {
        setHintTarget(null);
        setMessage({
          text: "You can't win from here. Please restart.",
          className: 'text-rose-300',
        });
        setTimeout(() => setMessage(null), 2400);
      }
      return 'used';
    } catch {
      setHintTarget(null);
      setMessage({
        text: 'Hint service unavailable.',
        className: 'text-rose-300',
      });
      setTimeout(() => setMessage(null), 2000);
      return 'failed';
    } finally {
      setHintLoading(false);
    }
  }, [hintConfirmSubmitting, hintLoading, state, token]);

  const openHintExchangeDialog = useCallback(async () => {
    setHintConfirmOpen(true);
    setHintConfirmLoading(true);
    setHintConfirmError(null);
    try {
      // 优先使用 hash 注入的初始资产值（bootstrap 场景可能为 null，需要再请求一次）
      const assets = portalAssets ?? (await getPortalAssets());
      if (!assets) {
        setPortalAssets(null);
        setHintConfirmError('Failed to load assets.');
      } else {
        setPortalAssets(assets);
      }
    } catch {
      setPortalAssets(null);
      setHintConfirmError('Failed to load assets.');
    } finally {
      setHintConfirmLoading(false);
    }
  }, [getPortalAssets, portalAssets]);

  const handleHint = useCallback(async () => {
    if (!token || !state.isPlaying || hintLoading || hintConfirmSubmitting) return;
    if (hintCount <= 0) {
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

    const result = await executeHint();
    if (result === 'need_exchange') {
      setExchangeType('hint');
      await openHintExchangeDialog();
      return;
    }
  }, [executeHint, hintConfirmSubmitting, hintCount, hintLoading, openHintExchangeDialog, portalBase, state.isPlaying, token]);

  const confirmHintExchange = useCallback(async () => {
    if (hintConfirmSubmitting || hintConfirmLoading) return;
    if (!portalBase || !token) return;
    setHintConfirmSubmitting(true);
    try {
      const itemId = exchangeType === 'undo' ? UNDO_ITEM_ID : HINT_ITEM_ID;
      const redeemRes = await fetch(
        `${portalBase}/api/user/shop/redeem?item_id=${encodeURIComponent(itemId)}&game_mode=${encodeURIComponent(HINT_GAME_MODE)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-User-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          },
        }
      );
      const redeemData = await redeemRes.json().catch(() => null);
      const redeemResult = redeemRes.ok && redeemData?.success
        ? { status: 'success' as const }
        : {
            status: extractPortalErrorCode(redeemData) === 'insufficient_assets'
              ? 'insufficient_assets' as const
              : 'error' as const,
            errorCode: extractPortalErrorCode(redeemData),
          };
      if (redeemResult.status === 'success') {
        const grantEndpoint = exchangeType === 'undo' ? '/api/undo/grant' : '/api/hint/grant';
        const grantRes = await fetch(`${getApiBase()}${grantEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount: 1 }),
        });
        const grantData = await grantRes.json().catch(() => null);
        if (exchangeType === 'undo') {
          if (grantData?.success && typeof grantData?.data?.undo_count === 'number') {
            setUndoCount(Math.max(0, Math.floor(grantData.data.undo_count)));
          } else {
            await loadProgress(state.gameMode);
          }
        } else {
          if (grantData?.success && typeof grantData?.data?.hint_count === 'number') {
            setHintCount(Math.max(0, Math.floor(grantData.data.hint_count)));
          } else {
            await loadProgress(state.gameMode);
          }
        }
        setHintConfirmError(null);
        const assets = await getPortalAssets();
        setPortalAssets(assets);
        setHintConfirmOpen(false);
        return;
      }
      const text = redeemResult.status === 'insufficient_assets'
        ? getPortalErrorMessage('insufficient_assets')
        : getPortalErrorMessage('insufficient_inventory');
      setHintConfirmError(text ?? `${exchangeType === 'undo' ? 'Undo' : 'Hint'} exchange failed.`);
    } finally {
      setHintConfirmSubmitting(false);
    }
  }, [exchangeType, getPortalAssets, hintConfirmLoading, hintConfirmSubmitting, loadProgress, portalBase, state.gameMode, token]);

  const isHomeView = modalType === 'mode';

  return (
    <div
      className={`game-root min-h-[100dvh] w-screen flex flex-col items-center justify-start md:justify-center relative overflow-hidden ${state.theme}`}
    >
      <PortalButton
        isHomeView={isHomeView}
        onBackHome={() => setModalType('mode')}
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
            tilesLeft={state.tilesLeft}
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
          <Board state={state} onMove={handleMove} shake={shake} hintTarget={hintTarget} />
          {hintConfirmOpen && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900/95 p-5 text-white shadow-2xl">
                <h3 className="text-xl font-bold mb-2">{exchangeType === 'undo' ? 'Use Undo' : 'Use Hint'}</h3>
                <p className="text-slate-300 mb-3">Cost: {HINT_PRICE_COINS} coins</p>
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
                    onClick={() => setHintConfirmOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-500 bg-slate-700/80 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmHintExchange}
                    disabled={hintConfirmLoading || hintConfirmSubmitting || !!hintConfirmError}
                    className="px-4 py-2 rounded-lg border border-amber-500 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hintConfirmSubmitting ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {message && (
            <div
              className={`absolute inset-0 flex items-center justify-center pointer-events-none z-50 transition-opacity duration-300 ${message.className}`}
            >
              <span className="text-4xl md:text-6xl font-bold drop-shadow-md fantasy-font">
                {message.text}
              </span>
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

      <MainModal
        type={modalType}
        gameMode={state.gameMode}
        startLevel={state.maxUnlockedLevel}
        winData={winData}
        username={username}
        leaderboard={leaderboard}
        leaderboardLoading={leaderboardLoading}
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
