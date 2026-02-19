'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import type { ModalType } from '@/lib/game/types';
import {
  gameReducer,
  initialGameState,
  canMoveToKing,
  isStuck,
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
  levelBonus?: number;
  streakBonus?: number;
  totalScore?: number;
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

type Props = { token: string | null; username: string };
type LeaderboardEntry = {
  rank: number;
  username: string;
  total_levels: number;
};
type LeaderboardMode = 'classic' | 'math_tour';

export default function GamePage({ token, username }: Props) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [modalType, setModalType] = useState<ModalType>('mode');
  const [winData, setWinData] = useState<WinData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('classic');
  const [hintCount, setHintCount] = useState(1);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintTarget, setHintTarget] = useState<{ r: number; c: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; className: string } | null>(null);
  const [shake, setShake] = useState(false);
  const fireStartRef = useRef<number>(0);
  const lastSpokenSecondRef = useRef<number>(4);
  const wonByCaptureRef = useRef(false);

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
      if (progressData.success && progressData.data?.high_score != null) {
        dispatch({ type: 'LOAD_HIGH_SCORE', payload: progressData.data.high_score });
      }
      if (progressData.success && progressData.data?.total_levels != null) {
        dispatch({
          type: 'SET_MAX_UNLOCKED_LEVEL',
          payload: normalizeUnlockedLevel(progressData.data.total_levels),
        });
      }
      if (progressData.success && typeof progressData.data?.hint_count === 'number') {
        setHintCount(Math.max(0, Math.floor(progressData.data.hint_count)));
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
      highScore: number,
      maxUnlockedLevel: number,
      levelData?: { level: number; moves_count: number; time_seconds: number; score: number; stars: number; game_mode: 'classic' | 'math_tour' }
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
            high_score: highScore,
            total_levels: maxUnlockedLevel,
            level_data: levelData,
          }),
        }).then(async (res) => {
          const data = await res.json().catch(() => null);
          if (data?.success && typeof data.data?.hint_count === 'number') {
            setHintCount(Math.max(0, Math.floor(data.data.hint_count)));
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
        .filter((item: any) => item && typeof item.username === 'string')
        .map((item: any, index: number) => ({
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
    loadProgress(state.gameMode);
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

  // Stuck check after move
  useEffect(() => {
    if (!state.isPlaying || state.grid.length === 0) return;
    if (isStuck(state)) {
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
        setMessage({ text: 'x2 Score Multiplier Active!', className: 'text-orange-400' });
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
      else if (s >= r * 1.1) stars = 3;
      else if (s >= r * 1.05) stars = 2;
      else stars = 1;
    } else {
      stars = 1;
      if (elapsed <= state.parTime) stars = 3;
      else if (elapsed <= state.parTime * 1.5) stars = 2;
    }
    const levelBonus = Math.floor(Math.random() * 501) + 500;
    const streakBonus = state.streak * 100;
    const newCumulative = state.cumulativeBaseScore + levelBonus;
    const newHighScore = Math.max(state.highScore, newCumulative);
    const nextUnlockedLevel = Math.min(MAX_LEVELS, Math.max(state.maxUnlockedLevel, state.level + 1));
    const runScoreAfterWin = state.currentRunScore + levelBonus + streakBonus;
    await saveProgress(newHighScore, nextUnlockedLevel, {
      level: state.level,
      moves_count: state.history.length,
      time_seconds: state.gameTimeSeconds,
      score: runScoreAfterWin,
      stars,
      game_mode: state.gameMode,
    });
    dispatch({ type: 'SET_MAX_UNLOCKED_LEVEL', payload: nextUnlockedLevel });
    dispatch({ type: 'UPSERT_LEVEL_STAR', payload: { level: state.level, stars } });
    dispatch({
      type: 'WIN_LEVEL',
      payload: { levelBonus, streakBonus },
    });
    setWinData({
      level: state.level,
      time: formatTime(state.gameTimeSeconds),
      stars,
      isFinalLevel: state.level >= MAX_LEVELS,
      levelBonus,
      streakBonus,
      totalScore: runScoreAfterWin,
      isNewHighScore: newCumulative > state.highScore,
      baseScore: newCumulative,
    });
    setHintTarget(null);
    setModalType('win');
  }

  const startLevel = useCallback(
    (level: number, useSaved: boolean) => {
      initSound();
      wonByCaptureRef.current = false;
      if (level === 1) {
        dispatch({ type: 'RESET_RUN' });
      }
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
    dispatch({ type: 'PREPARE_RETRY' });
    dispatch({ type: 'START_LEVEL', payload: saved });
    setHintTarget(null);
    setModalType('none');
  }, [state.savedGridConfig]);

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

  const handleHint = useCallback(async () => {
    if (!token || !state.isPlaying || hintLoading) return;
    if (hintCount <= 0) {
      setMessage({
        text: 'No hints left.',
        className: 'text-amber-300',
      });
      setTimeout(() => setMessage(null), 1800);
      return;
    }

    setHintLoading(true);
    try {
      const consumeRes = await fetch(`${getApiBase()}/api/hint/use`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const consumeData = await consumeRes.json();
      if (!consumeData?.success) {
        if (typeof consumeData?.data?.hint_count === 'number') {
          setHintCount(Math.max(0, Math.floor(consumeData.data.hint_count)));
        }
        setMessage({
          text: 'No hints left.',
          className: 'text-amber-300',
        });
        setTimeout(() => setMessage(null), 1800);
        return;
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
    } catch {
      setHintTarget(null);
      setMessage({
        text: 'Hint service unavailable.',
        className: 'text-rose-300',
      });
      setTimeout(() => setMessage(null), 2000);
    } finally {
      setHintLoading(false);
    }
  }, [hintCount, hintLoading, state, token]);

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
          />
          <Board state={state} onMove={handleMove} shake={shake} hintTarget={hintTarget} />
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
        winData={winData}
        highScore={state.highScore}
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
        onStartLevel={() => startLevel(1, false)}
        onNextLevel={nextLevel}
        onRetry={restartLevel}
        onCloseOverlay={() => setModalType(modalType === 'leaderboard' ? 'mode' : 'none')}
        onSetTheme={(name) => dispatch({ type: 'SET_THEME', payload: name })}
      />
    </div>
  );
}

