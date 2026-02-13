'use client';

import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import type { ModalType } from '@/lib/game/types';
import {
  gameReducer,
  initialGameState,
  canMoveToKing,
  isStuck,
} from '@/lib/game/gameReducer';
import { generateLevelConfig } from '@/lib/game/levelGenerator';
import {
  initSound,
  playMove,
  playCollect,
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

type WinData = {
  level: number;
  time: string;
  stars: number;
  levelBonus: number;
  currentScore: number;
  baseScore: number;
  isNewHighScore: boolean;
  streak: number;
  streakBonus: number;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

type Props = { token: string | null; username: string };

export default function GamePage({ token, username }: Props) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [modalType, setModalType] = useState<ModalType>('mode');
  const [winData, setWinData] = useState<WinData | null>(null);
  const [message, setMessage] = useState<{ text: string; className: string } | null>(null);
  const [shake, setShake] = useState(false);
  const fireStartRef = useRef<number>(0);
  const lastSpokenSecondRef = useRef<number>(4);

  const loadProgress = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await fetch(`${getApiBase()}/api/progress/load`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data?.high_score != null) {
        dispatch({ type: 'LOAD_HIGH_SCORE', payload: data.data.high_score });
      }
      return data.data;
    } catch {
      return null;
    }
  }, [token]);

  const saveProgress = useCallback(
    async (highScore: number) => {
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
            total_levels: 0,
          }),
        });
      } catch (e) {
        console.error(e);
      }
    },
    [token]
  );

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

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

  const handleMove = useCallback(
    (r: number, c: number) => {
      const tile = state.grid[r]?.[c];
      if (!tile || tile.type === 'void' || tile.visited) return;
      if (tile.type === 'king') {
        if (!canMoveToKing(state)) {
          setMessage({
            text: state.gameMode === 'classic' ? 'Guards remain!' : `Need ${state.requiredScore - state.currentScore} more score!`,
            className: 'text-rose-400',
          });
          setTimeout(() => setMessage(null), 1500);
          setShake(true);
          setTimeout(() => setShake(false), 500);
          return;
        }
        handleWin();
        return;
      }
      const dr = Math.abs(state.knightPos.r - r);
      const dc = Math.abs(state.knightPos.c - c);
      if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      const collectedValue = state.gameMode === 'math_tour' ? tile.value * state.scoreMultiplier : 0;
      dispatch({ type: 'MOVE', payload: { r, c } });
      playMove();
      if (state.gameMode === 'math_tour' && collectedValue > 0) playCollect();
    },
    [state]
  );

  function handleWin() {
    playVictory();
    const elapsed = (Date.now() - state.gameStartTime) / 1000;
    let stars = 1;
    if (elapsed <= state.parTime) stars = 3;
    else if (elapsed <= state.parTime * 1.5) stars = 2;
    const levelBonus = Math.floor(Math.random() * 501) + 500;
    const streakBonus = state.streak * 100;
    const newCumulative = state.cumulativeBaseScore + levelBonus;
    const newStreak = state.streak + 1;
    const newRunScore = state.currentRunScore + levelBonus + streakBonus;
    const isNewHigh = newCumulative > state.highScore;
    if (isNewHigh) saveProgress(newCumulative);

    dispatch({
      type: 'WIN_LEVEL',
      payload: { levelBonus, streakBonus },
    });
    setWinData({
      level: state.level,
      time: formatTime(state.gameTimeSeconds),
      stars,
      levelBonus,
      currentScore: newRunScore,
      baseScore: newCumulative,
      isNewHighScore: isNewHigh,
      streak: newStreak,
      streakBonus,
    });
    setModalType('win');
  }

  const startLevel = useCallback(
    (level: number, useSaved: boolean) => {
      initSound();
      if (level === 1) {
        dispatch({ type: 'RESET_RUN' });
      }
      let config;
      if (useSaved && state.savedGridConfig && state.savedGridConfig.level === level) {
        config = state.savedGridConfig;
      } else {
        config = generateLevelConfig(level, state.gameMode);
        dispatch({ type: 'SET_SAVED_CONFIG', payload: config });
      }
      dispatch({ type: 'START_LEVEL', payload: config });
      setModalType('none');
    },
    [state.savedGridConfig, state.gameMode]
  );

  const nextLevel = useCallback(() => {
    dispatch({ type: 'SET_SAVED_CONFIG', payload: null });
    startLevel(state.level + 1, false);
  }, [state.level, startLevel]);

  const restartLevel = useCallback(() => {
    const saved = state.savedGridConfig;
    if (!saved) return;
    dispatch({ type: 'PREPARE_RETRY' });
    dispatch({ type: 'START_LEVEL', payload: saved });
    setModalType('none');
  }, [state.savedGridConfig]);

  const setMode = useCallback((mode: 'classic' | 'math_tour') => {
    dispatch({ type: 'SET_MODE', payload: mode });
    setModalType('welcome');
  }, []);

  const isHomeView = modalType === 'mode';

  return (
    <div
      className={`h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden ${state.theme}`}
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
            username={username}
            tilesLeft={state.tilesLeft}
            currentScore={state.currentScore}
            requiredScore={state.requiredScore}
            onUndo={() => dispatch({ type: 'UNDO' })}
            onRestart={restartLevel}
            onSettings={() => setModalType('settings')}
            onHelp={() => setModalType('help')}
          />
          <TilesAndScoreBar
            gameMode={state.gameMode}
            tilesLeft={state.tilesLeft}
            gameTimeSeconds={state.gameTimeSeconds}
            currentScore={state.currentScore}
            requiredScore={state.requiredScore}
          />
          <Board state={state} onMove={handleMove} shake={shake} />
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
            ? 'Collect score → Capture King'
            : 'Clear board → Capture King'}
          <span className="text-rose-500 font-bold"> King</span>
        </p>
      </div>

      <MainModal
        type={modalType}
        gameMode={state.gameMode}
        highScore={state.highScore}
        winData={winData}
        onSetMode={setMode}
        onStartLevel={() => startLevel(1, false)}
        onNextLevel={nextLevel}
        onRetry={restartLevel}
        onCloseOverlay={() => setModalType('none')}
        onSetTheme={(name) => dispatch({ type: 'SET_THEME', payload: name })}
      />
    </div>
  );
}
