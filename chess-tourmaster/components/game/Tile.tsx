'use client';

import type { TileData } from '@/lib/game/types';

const PIECE_ICON: Record<NonNullable<TileData['piece']>, string> = {
  pawn: 'fa-chess-pawn',
  knight: 'fa-chess-knight',
  bishop: 'fa-chess-bishop',
  rook: 'fa-chess-rook',
  queen: 'fa-chess-queen',
};

/** 方格内所有棋子/图标统一尺寸，改此处即可统一调整 */
const PIECE_SIZE = 'text-3xl sm:text-4xl md:text-5xl';

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
      {showQuestValue && !isKnight && tile.piece && (
        <i
          className={`fas ${PIECE_ICON[tile.piece]} absolute ${PIECE_SIZE} drop-shadow-md ${visited ? 'opacity-50 text-slate-400' : (tile.tileMultiplier ?? 1) > 1 ? 'text-lime-400' : (tile.value ?? 0) < 0 ? 'text-rose-400' : 'text-amber-300'}`}
          aria-hidden
        />
      )}
      {showQuestValue && !isKnight && !visited && ((tile.tileMultiplier ?? 1) > 1 || (tile.value ?? 0) !== 0) && (
        <span className={`quest-value absolute top-1 right-2 font-bold text-xs sm:text-sm drop-shadow-md ${(tile.tileMultiplier ?? 1) > 1 ? 'text-lime-400' : (tile.value ?? 0) < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
          {(tile.tileMultiplier ?? 1) > 1 ? `x${tile.tileMultiplier}` : `${(tile.value ?? 0) >= 0 ? '+' : ''}${tile.value}`}
        </span>
      )}
      {tile.hasFire && (
        <i className={`fas fa-fire ${PIECE_SIZE} text-orange-500 fire-anim opacity-90`} />
      )}
      {isKing && (
        <i className={`fas fa-chess-king king-piece ${PIECE_SIZE} text-rose-500`} />
      )}
      {isKnight && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] rounded-lg">
          <i className={`fas fa-chess-knight knight-piece ${PIECE_SIZE} text-cyan-400`} />
        </div>
      )}
    </div>
  );
}
