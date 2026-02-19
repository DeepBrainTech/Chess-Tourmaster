'use client';

import { MAX_LEVELS } from '@/lib/game/levelCatalog';

type Props = {
  gameMode: 'classic' | 'math_tour';
  level: number;
  maxUnlockedLevel: number;
  levelStars: Record<number, number>;
  username?: string;
  tilesLeft: number;
  onSelectLevel: (level: number) => void;
  onRestart: () => void;
  onHint: () => void;
  hintCount: number;
  hintLoading: boolean;
  onSettings: () => void;
  onHelp: () => void;
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function GameHeader({
  gameMode,
  level,
  maxUnlockedLevel,
  levelStars,
  username,
  tilesLeft,
  onSelectLevel,
  onRestart,
  onHint,
  hintCount,
  hintLoading,
  onSettings,
  onHelp,
}: Props) {
  const isMathTour = gameMode === 'math_tour';

  return (
    <div className="z-10 w-full max-w-[95vw] lg:max-w-5xl xl:max-w-6xl px-4 lg:px-6 xl:px-8 mb-3 flex items-start">
      <div className="min-w-0 flex-1" aria-hidden="true" />
      <div className="min-w-0 flex shrink-0 flex-col items-center text-center">
        <h1 className="text-xl md:text-3xl lg:text-4xl text-rose-500 font-bold fantasy-font tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          <i className="fas fa-chess-board mr-2" /> Tourmaster
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 lg:gap-x-4 xl:gap-x-6 text-sm md:text-base lg:text-lg text-gray-300 mt-1">
          <span className="font-bold text-white">
            {isMathTour ? 'Math Tour' : 'Classic Tour'}
          </span>
          <span className="text-gray-500">|</span>
          <label className="flex items-center gap-2">
            <span>Lv.</span>
            <select
              value={level}
              onChange={(e) => onSelectLevel(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-white text-xs md:text-sm xl:min-w-[170px]"
            >
              {Array.from({ length: MAX_LEVELS }, (_, index) => {
                const optionLevel = index + 1;
                const locked = optionLevel > maxUnlockedLevel;
                const stars = levelStars[optionLevel] ?? 0;
                const starsLabel = stars > 0 ? ` - ${'\u2B50'.repeat(stars)}` : '';
                return (
                  <option key={optionLevel} value={optionLevel} disabled={locked}>
                    {locked ? `Lv. ${optionLevel} (Locked)` : `Lv. ${optionLevel}${starsLabel}`}
                  </option>
                );
              })}
            </select>
            <span className="text-white">/ {MAX_LEVELS}</span>
          </label>
          {username != null && username !== '' && (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-cyan-300">
                <i className="fas fa-user mr-1" />
                {username}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1 flex justify-end gap-2 lg:gap-3 xl:gap-4 pl-3 xl:pl-6">
        <button
          type="button"
          onClick={onRestart}
          className="bg-slate-700/80 hover:bg-slate-600 text-white p-2 lg:p-3 rounded-lg shadow-lg border border-slate-500"
          title="Restart"
        >
          <i className="fas fa-redo" />
        </button>
        <button
          type="button"
          onClick={onHint}
          disabled={hintLoading || hintCount <= 0}
          className="bg-amber-700/80 hover:bg-amber-600 text-white px-2 lg:px-3 py-2 lg:py-3 rounded-lg shadow-lg border border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Hint (${hintCount})`}
        >
          <i className="fas fa-lightbulb mr-1" />
          {hintLoading ? '...' : hintCount}
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="bg-indigo-700/80 hover:bg-indigo-600 text-white p-2 lg:p-3 rounded-lg shadow-lg border border-indigo-500"
          title="Settings"
        >
          <i className="fas fa-cog" />
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="bg-rose-700/80 hover:bg-rose-600 text-white p-2 lg:p-3 rounded-lg shadow-lg border border-rose-500"
          title="Help"
        >
          <i className="fas fa-question" />
        </button>
      </div>
    </div>
  );
}

export function TilesAndScoreBar({
  tilesLeft,
  gameTimeSeconds,
  gameMode,
  currentScore,
  requiredScore,
}: {
  tilesLeft: number;
  gameTimeSeconds: number;
  gameMode?: 'classic' | 'math_tour';
  currentScore?: number;
  requiredScore?: number;
}) {
  const isMathTour = gameMode === 'math_tour';
  const hasEnoughScore = isMathTour && requiredScore != null && currentScore != null && currentScore >= requiredScore;
  return (
    <div className="z-10 w-full max-w-[95vw] lg:max-w-5xl px-4 lg:px-6 mb-3 flex flex-wrap justify-center items-center gap-3 min-h-8">
      <div className="text-cyan-300 font-bold text-sm md:text-lg lg:text-xl flex items-center gap-3 bg-slate-900/50 px-3 lg:px-4 py-1 lg:py-1.5 rounded-full border border-slate-700">
        <span>
          Tiles Left: <span className="ml-2 text-white">{tilesLeft}</span>
        </span>
        <span className="text-slate-500">|</span>
        <span className="font-mono">
          <i className="far fa-clock mr-1" />
          {formatTime(gameTimeSeconds)}
        </span>
      </div>
      {isMathTour && requiredScore != null && (
        <div
          className={`font-bold text-sm md:text-lg lg:text-xl flex items-center bg-slate-900/50 px-3 lg:px-4 py-1 lg:py-1.5 rounded-full border border-slate-700 ${hasEnoughScore ? 'text-lime-400' : 'text-amber-300'}`}
        >
          Score: <span className="ml-1 text-white">{currentScore ?? 0}</span>
          <span className="mx-1 text-slate-500">/</span>
          <span className="text-white">{requiredScore}</span>
        </div>
      )}
    </div>
  );
}
