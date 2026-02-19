'use client';

import type { TileData } from '@/lib/game/types';

type Props = {
  tile: TileData;
  isKnight: boolean;
  isValidMove: boolean;
  isHintTarget: boolean;
  onClick: () => void;
  showQuestValue?: boolean;
  scoreMultiplier?: number;
};

export default function Tile({
  tile,
  isKnight,
  isValidMove,
  isHintTarget,
  onClick,
  showQuestValue = false,
  scoreMultiplier = 1,
}: Props) {
  const isVoid = tile.type === 'void';
  const isKing = tile.type === 'king';
  const visited = tile.visited && !isKnight;

  let classes =
    'tile w-full rounded-lg flex items-center justify-center border-slate-600';
  let zIndex = 10;

  if (isVoid) {
    classes += ' opacity-0 pointer-events-none';
    zIndex = 0;
  } else if (isKing) {
    classes += ' king-tile';
    if (isValidMove) classes += ' valid-move !bg-rose-500/30';
  }

  if (visited) classes += ' visited';
  if (isValidMove) classes += ' valid-move';
  if (isHintTarget) classes += ' hint-target';

  if (isKnight) zIndex = 30;

  return (
    <div
      className={classes}
      style={{ zIndex }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {showQuestValue && ((tile.tileMultiplier ?? 1) > 1 || (tile.value ?? 0) !== 0) && (
        <span className={`quest-value absolute top-1 right-2 font-bold text-xs sm:text-sm drop-shadow-md ${(tile.tileMultiplier ?? 1) > 1 ? 'text-lime-400' : (tile.value ?? 0) < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
          {(tile.tileMultiplier ?? 1) > 1 ? `x${tile.tileMultiplier}` : `${(tile.value ?? 0) >= 0 ? '+' : ''}${tile.value}`}
        </span>
      )}
      {tile.hasFire && (
        <i className="fas fa-fire text-2xl sm:text-3xl text-orange-500 fire-anim opacity-90" />
      )}
      {isKing && (
        <i className="fas fa-chess-king king-piece text-2xl sm:text-3xl md:text-4xl text-rose-500" />
      )}
      {isKnight && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] rounded-lg">
          <i className="fas fa-chess-knight knight-piece text-3xl sm:text-4xl md:text-5xl text-cyan-400" />
        </div>
      )}
    </div>
  );
}
