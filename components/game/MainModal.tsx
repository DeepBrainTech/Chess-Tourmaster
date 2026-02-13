'use client';

import type { ModalType } from '@/lib/game/types';

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

type Props = {
  type: ModalType;
  gameMode: 'classic' | 'math_tour';
  highScore: number;
  winData: WinData | null;
  onSetMode: (mode: 'classic' | 'math_tour') => void;
  onStartLevel: () => void;
  onNextLevel: () => void;
  onRetry: () => void;
};

export default function MainModal({
  type,
  gameMode,
  highScore,
  winData,
  onSetMode,
  onStartLevel,
  onNextLevel,
  onRetry,
}: Props) {
  if (type === 'none') return null;

  const isMathTour = gameMode === 'math_tour';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
      <div className="bg-gray-800 border-2 border-rose-600 p-6 md:p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center m-4 relative">
        {type === 'mode' && (
          <>
            <div className="mb-4 text-6xl flex justify-center gap-4">
              <i className="fas fa-chess-knight text-cyan-500" />
              <i className="fas fa-chess-king text-rose-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 fantasy-font">
              Chess Tourmaster
            </h2>
            <p className="text-sm text-gray-400 mb-4">Select your game mode:</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onSetMode('classic')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition"
              >
                Classic Tour
              </button>
              <button
                type="button"
                onClick={() => onSetMode('math_tour')}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition"
              >
                Math Tour
              </button>
            </div>
          </>
        )}

        {type === 'welcome' && (
          <>
            <div className="mb-4 text-6xl flex justify-center gap-4">
              <i className="fas fa-chess-knight text-cyan-500" />
              <i className="fas fa-chess-king text-rose-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 fantasy-font">
              {isMathTour ? 'Math Tour' : 'Classic Tour'}
            </h2>
            <p className="text-gray-300 mb-4 text-sm">
              {isMathTour
                ? 'Collect enough score and capture the King.'
                : 'Clear every tile and capture the King.'}
            </p>
            <p className="text-lg font-mono text-yellow-300 mb-4 fantasy-font">
              HIGH SCORE: {highScore.toLocaleString()}
            </p>
            <button
              type="button"
              onClick={onStartLevel}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:scale-105"
            >
              Start Level 1
            </button>
          </>
        )}

        {type === 'win' && winData && (
          <>
            <div className="mb-4 text-6xl flex justify-center">
              <i className="fas fa-crown text-yellow-400" />
            </div>
            <div className="flex justify-center gap-2 mb-2 text-3xl">
              {[1, 2, 3].map(i => (
                <i
                  key={i}
                  className={
                    i <= winData.stars
                      ? 'fas fa-star text-yellow-400'
                      : 'far fa-star text-gray-600'
                  }
                />
              ))}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 fantasy-font">
              Checkmate!
            </h2>
            <p className="text-gray-300 mb-1">
              Level {winData.level} Complete
            </p>
            <p className="text-xl font-bold text-cyan-400 mb-4">
              Time: {winData.time}
            </p>
            <div className="mt-4 border-t border-slate-700 pt-3 text-left text-sm text-gray-400">
              <p>
                Level Bonus:{' '}
                <span className="text-lime-400 font-bold">
                  +{winData.levelBonus.toLocaleString()}
                </span>
              </p>
              {winData.streak > 1 && (
                <p>
                  Streak x{winData.streak} Bonus:{' '}
                  <span className="text-yellow-400 font-bold">
                    +{winData.streakBonus.toLocaleString()}
                  </span>
                </p>
              )}
              <p className="text-xl font-bold text-yellow-300 mt-1">
                Total Score: {winData.currentScore.toLocaleString()}
              </p>
              {winData.isNewHighScore && (
                <p className="text-sm font-bold text-rose-500 mt-2">
                  NEW HIGH SCORE! (Base: {winData.baseScore.toLocaleString()})
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onNextLevel}
              className="mt-6 w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition"
            >
              Next Level
            </button>
          </>
        )}

        {type === 'lose' && (
          <>
            <div className="mb-4 text-6xl flex justify-center">
              <i className="fas fa-skull text-gray-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 fantasy-font">
              Defeat
            </h2>
            <p className="text-gray-300 mb-4">Trapped or burned!</p>
            <p className="text-lg font-mono text-yellow-300 mb-4 fantasy-font">
              HIGH SCORE: {highScore.toLocaleString()}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
