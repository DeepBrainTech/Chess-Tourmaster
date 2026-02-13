'use client';

type Props = {
  gameMode: 'classic' | 'math_tour';
  level: number;
  gameTimeSeconds: number;
  tilesLeft: number;
  currentScore: number;
  requiredScore: number;
  onUndo: () => void;
  onRestart: () => void;
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
  gameTimeSeconds,
  tilesLeft,
  currentScore,
  requiredScore,
  onUndo,
  onRestart,
  onSettings,
  onHelp,
}: Props) {
  const isMathTour = gameMode === 'math_tour';
  const scoreOk = currentScore >= requiredScore;

  return (
    <div className="z-10 w-full max-w-2xl px-4 mb-2 flex justify-between items-center">
      <div>
        <h1 className="text-xl md:text-3xl text-rose-500 font-bold fantasy-font tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          <i className="fas fa-chess-board mr-2" /> Tourmaster
        </h1>
        <div className="flex items-center gap-3 text-sm md:text-base text-gray-300 mt-1">
          <span className="font-bold text-white">
            {isMathTour ? 'Math Tour' : 'Classic Tour'}
          </span>
          <span className="text-gray-500">|</span>
          <span>
            Lvl <span className="font-bold text-white">{level}</span>
          </span>
          <span className="text-gray-500">|</span>
          <span className="font-mono text-cyan-300">
            <i className="far fa-clock mr-1" />
            {formatTime(gameTimeSeconds)}
          </span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUndo}
          className="bg-slate-700/80 hover:bg-slate-600 text-white p-2 rounded-lg shadow-lg border border-slate-500"
          title="Undo"
        >
          <i className="fas fa-undo" />
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="bg-slate-700/80 hover:bg-slate-600 text-white p-2 rounded-lg shadow-lg border border-slate-500"
          title="Restart"
        >
          <i className="fas fa-redo" />
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="bg-indigo-700/80 hover:bg-indigo-600 text-white p-2 rounded-lg shadow-lg border border-indigo-500"
          title="Settings"
        >
          <i className="fas fa-cog" />
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="bg-rose-700/80 hover:bg-rose-600 text-white p-2 rounded-lg shadow-lg border border-rose-500"
          title="Help"
        >
          <i className="fas fa-question" />
        </button>
      </div>
    </div>
  );
}

export function TilesAndScoreBar({
  gameMode,
  tilesLeft,
  gameTimeSeconds,
  currentScore,
  requiredScore,
}: {
  gameMode: 'classic' | 'math_tour';
  tilesLeft: number;
  gameTimeSeconds: number;
  currentScore: number;
  requiredScore: number;
}) {
  const isMathTour = gameMode === 'math_tour';
  const scoreOk = currentScore >= requiredScore;

  return (
    <div className="z-10 w-full max-w-2xl px-4 mb-2 flex flex-wrap justify-between items-center h-8">
      <div className="text-cyan-300 font-bold text-sm md:text-lg flex items-center gap-3 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
        <span>
          Tiles Left: <span className="ml-2 text-white">{tilesLeft}</span>
        </span>
        <span className="text-slate-500">|</span>
        <span className="font-mono">
          <i className="far fa-clock mr-1" />
          {formatTime(gameTimeSeconds)}
        </span>
      </div>
      {isMathTour && (
        <div
          className={`font-bold text-sm md:text-lg flex items-center bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700 ${
            scoreOk ? 'text-lime-400' : 'text-amber-300'
          }`}
        >
          Score: <span className="ml-1 text-white">{currentScore}</span> /{' '}
          <span className="text-white">{requiredScore}</span>
        </div>
      )}
    </div>
  );
}
