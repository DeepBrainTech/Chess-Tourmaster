'use client';

import type { ModalType, ThemeName } from '@/lib/game/types';

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
  onCloseOverlay?: () => void;
  onSetTheme?: (name: ThemeName) => void;
};

const THEME_BUTTONS: { name: ThemeName; label: string; btnClass: string }[] = [
  { name: 'cosmic', label: 'Cosmic', btnClass: 'bg-indigo-900 border-indigo-700 hover:bg-indigo-800' },
  { name: 'royal', label: 'Royal', btnClass: 'bg-purple-900 border-purple-700 hover:bg-purple-800' },
  { name: 'nature', label: 'Nature', btnClass: 'bg-emerald-900 border-emerald-700 hover:bg-emerald-800' },
  { name: 'inferno', label: 'Inferno', btnClass: 'bg-red-900 border-red-700 hover:bg-red-800' },
  { name: 'desert', label: 'Desert', btnClass: 'bg-yellow-800 border-yellow-600 hover:bg-yellow-700' },
  { name: 'frost', label: 'Frost', btnClass: 'bg-blue-700 border-blue-500 hover:bg-blue-600' },
  { name: 'volcanic', label: 'Volcanic', btnClass: 'bg-zinc-700 border-zinc-500 hover:bg-zinc-600' },
];

export default function MainModal({
  type,
  gameMode,
  highScore,
  winData,
  onSetMode,
  onStartLevel,
  onNextLevel,
  onRetry,
  onCloseOverlay,
  onSetTheme,
}: Props) {
  if (type === 'none') return null;

  const isMathTour = gameMode === 'math_tour';
  const isOverlayModal = type === 'settings' || type === 'help';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={isOverlayModal ? onCloseOverlay : undefined}
      role={isOverlayModal ? 'button' : undefined}
      tabIndex={isOverlayModal ? 0 : undefined}
      onKeyDown={isOverlayModal && onCloseOverlay ? (e) => e.key === 'Escape' && onCloseOverlay() : undefined}
    >
      {type === 'settings' && onSetTheme && onCloseOverlay && (
        <div
          className="bg-gray-800 border-2 border-indigo-500 p-6 rounded-2xl shadow-2xl max-w-xs w-full m-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-bold text-indigo-400 mb-4 fantasy-font text-center">Select Theme</h3>
          <div className="grid grid-cols-2 gap-3">
            {THEME_BUTTONS.map(({ name, label, btnClass }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onSetTheme(name);
                }}
                className={`p-3 rounded-lg border text-white text-sm ${btnClass}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onCloseOverlay}
            className="mt-6 w-full bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-600 text-sm"
          >
            Close
          </button>
        </div>
      )}

      {type === 'help' && onCloseOverlay && (
        <div
          className="bg-slate-800 border-2 border-slate-500 p-6 rounded-2xl shadow-2xl max-w-sm w-full m-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-2xl font-bold text-rose-500 mb-4 fantasy-font border-b border-slate-600 pb-2">
            {isMathTour ? 'Instructions (Math Tour)' : 'Instructions (Classic Tour)'}
          </h3>
          <ul className="text-left text-gray-300 space-y-3 text-sm">
            <li className="flex items-start">
              <i className="fas fa-chess-knight w-6 text-cyan-400 mt-1" />
              <span><strong>Move:</strong> L-shape jump to clear tiles.</span>
            </li>
            {isMathTour && (
              <li className="flex items-start">
                <i className="fas fa-plus w-6 text-amber-400 mt-1" />
                <span><strong>Gather:</strong> Collect tile points to meet score requirement for King capture.</span>
              </li>
            )}
            <li className="flex items-start">
              <i className="fas fa-fire w-6 text-orange-500 mt-1" />
              <span><strong>Fire:</strong> 3s to move or burn! (In Math Tour, landing on fire grants x2 score on the next move).</span>
            </li>
            <li className="flex items-start">
              <i className="fas fa-chess-king w-6 text-rose-500 mt-1" />
              <span><strong>Win:</strong> {isMathTour ? 'Meet score requirement' : 'Clear board'} to capture King.</span>
            </li>
          </ul>
          <button
            type="button"
            onClick={onCloseOverlay}
            className="mt-6 w-full bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-600"
          >
            Close
          </button>
        </div>
      )}

      {!isOverlayModal && (
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
      )}
    </div>
  );
}
