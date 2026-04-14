'use client';

import type { ModalType, ThemeName } from '@/lib/game/types';

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

type LeaderboardEntry = {
  rank: number;
  username: string;
  total_levels: number;
};
type LeaderboardMode = 'classic' | 'math_tour';

type Props = {
  type: ModalType;
  gameMode: 'classic' | 'math_tour';
  startLevel: number;
  winData: WinData | null;
  username?: string;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardMode: LeaderboardMode;
  onSetMode: (mode: 'classic' | 'math_tour') => void;
  onOpenLeaderboard: () => void;
  onChangeLeaderboardMode: (mode: LeaderboardMode) => void;
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
  startLevel,
  winData,
  username,
  leaderboard,
  leaderboardLoading,
  leaderboardMode,
  onSetMode,
  onOpenLeaderboard,
  onChangeLeaderboardMode,
  onStartLevel,
  onNextLevel,
  onRetry,
  onCloseOverlay,
  onSetTheme,
}: Props) {
  if (type === 'none') return null;

  const isMathTour = gameMode === 'math_tour';
  const isOverlayModal = type === 'settings' || type === 'help' || type === 'leaderboard';

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
              <span><strong>Fire:</strong> {isMathTour ? '3s to move or burn! Fire tile = x3 score when you land on it (no piece on fire).' : '3s to move or burn!'}</span>
            </li>
            <li className="flex items-start">
              <i className="fas fa-chess-king w-6 text-rose-500 mt-1" />
              <span><strong>Win:</strong> {isMathTour ? 'Meet score requirement to capture King.' : 'Clear board to capture King.'}</span>
            </li>
            <li className="flex items-start">
              <i className="fas fa-star w-6 text-yellow-400 mt-1" />
              <span><strong>Stars:</strong> {isMathTour ? 'By score (≥110% = 3★, ≥105% = 2★).' : 'By time (faster = more stars).'}</span>
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

      {type === 'leaderboard' && onCloseOverlay && (
        <div
          className="w-full max-w-2xl m-4 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-br from-rose-900 via-red-800 to-amber-600 p-4 md:p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl md:text-3xl font-bold text-white fantasy-font">
              <i className="fas fa-trophy text-amber-300 mr-3" />
              Leaderboard
            </h3>
            <button
              type="button"
              onClick={onCloseOverlay}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white"
              aria-label="Close leaderboard"
            >
              <i className="fas fa-times" />
            </button>
          </div>
          <p className="text-sm text-amber-100/90 mb-3">Total Levels Unlocked</p>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => onChangeLeaderboardMode('classic')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                leaderboardMode === 'classic'
                  ? 'bg-white/20 border-amber-300 text-white'
                  : 'bg-black/20 border-white/20 text-white/80 hover:bg-black/30'
              }`}
            >
              Classic Tour
            </button>
            <button
              type="button"
              onClick={() => onChangeLeaderboardMode('math_tour')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                leaderboardMode === 'math_tour'
                  ? 'bg-white/20 border-amber-300 text-white'
                  : 'bg-black/20 border-white/20 text-white/80 hover:bg-black/30'
              }`}
            >
              Math Tour
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {leaderboardLoading ? (
              <div className="rounded-xl bg-black/20 border border-white/15 px-4 py-3 text-white/80 text-sm">
                Loading...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-xl bg-black/20 border border-white/15 px-4 py-3 text-white/80 text-sm">
                No records yet
              </div>
            ) : (
              leaderboard.map((entry) => {
                const isCurrentUser = username != null && username !== '' && entry.username === username;
                return (
                  <div
                    key={`${entry.rank}-${entry.username}`}
                    className={`rounded-xl px-4 py-3 border ${
                      isCurrentUser
                        ? 'bg-white/15 border-amber-300 text-white'
                        : 'bg-black/20 border-white/15 text-white/95'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {entry.rank}. {entry.username}
                        {isCurrentUser ? ' (You)' : ''}
                      </span>
                      <span className="font-bold text-amber-200">Level {entry.total_levels}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition"
              >
                <i className="fas fa-trophy mr-2 text-amber-300" />
                Leaderboard
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
            <div className="text-gray-300 mb-4 text-sm text-left space-y-2">
              {isMathTour ? (
                <>
                  <p className="font-medium text-amber-200/90">Math Tour Rules</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Knight moves in L-shape; land on tiles to collect score (2–5 per tile)</li>
                    <li>Fire tile multiplies your score by 3 when you land on it; leave within 3s</li>
                    <li>Reach the target score to capture the King; stars depend on score ratio</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-medium text-cyan-200/90">Classic Tour Rules</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Knight moves in L-shape; clear every reachable tile</li>
                    <li>Leave fire tiles within 3 seconds or you lose</li>
                    <li>Capture the King after clearing the board; stars depend on time</li>
                  </ul>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onStartLevel}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:scale-105"
            >
              {`Start Level ${startLevel}`}
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
              {winData.isFinalLevel ? 'Level 100 Complete - All Levels Cleared!' : `Level ${winData.level} Complete`}
            </p>
            <p className="text-xl font-bold text-cyan-400 mb-2">
              Time: {winData.time}
            </p>
            <button
              type="button"
              onClick={onNextLevel}
              className="mt-6 w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition"
            >
              {winData.isFinalLevel ? 'Back to Mode Select' : 'Next Level'}
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
