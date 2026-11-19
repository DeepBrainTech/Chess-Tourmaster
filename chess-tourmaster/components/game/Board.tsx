'use client';

import type { GameState } from '@/lib/game/types';
import { isValidMove } from '@/lib/game/gameReducer';
import Tile from './Tile';
import Image from 'next/image';
import classicStyles from './ClassicTour.module.css';

type Props = {
  state: GameState;
  onMove: (r: number, c: number) => void;
  shake: boolean;
  hintTarget: { r: number; c: number } | null;
  locked?: boolean;
};

export default function Board({ state, onMove, shake, hintTarget, locked = false }: Props) {
  const size = state.gridSizeVal;
  const classic = state.gameMode === 'classic';

  if (!state.grid.length) {
    return (
      <div className="z-10 relative bg-slate-800/60 p-4 rounded-xl w-full max-w-2xl aspect-square flex items-center justify-center mx-auto text-gray-400">
        Loading board...
      </div>
    );
  }

  return (
    <div
      id="game-board"
      data-mode={state.gameMode}
      inert={locked || undefined}
      role={classic ? 'group' : undefined}
      aria-label={classic ? 'Classic Tour chessboard' : undefined}
      className={classic ? `${classicStyles.board} ${shake ? 'shake' : ''}` : `board-shell z-10 relative bg-slate-800/60 p-2 md:p-3 lg:p-4 rounded-xl shadow-2xl border-4 border-slate-600 backdrop-blur-md w-full max-w-[95vw] md:max-w-3xl lg:max-w-4xl aspect-square flex items-center justify-center mx-auto grid gap-1 md:gap-1.5 lg:gap-2 ${shake ? 'shake' : ''}`}
      data-shake={classic && shake ? 'true' : undefined}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: classic ? `repeat(${size}, minmax(0, 1fr))` : undefined }}
    >
      {state.grid.flatMap((row, r) =>
        row.map((tile, c) => {
          const isKnight =
            state.knightPos.r === r && state.knightPos.c === c;
          const valid =
            state.isPlaying &&
            !locked &&
            isValidMove(state, r, c);
          const isHintTarget =
            hintTarget != null &&
            hintTarget.r === r &&
            hintTarget.c === c;
          if (classic) {
            const dimmed = hintTarget != null && !isKnight && !isHintTarget;
            const empty = !isKnight && (tile.type === 'void' || tile.visited);
            if (empty) return <span key={`${r}-${c}`} className={classicStyles.emptyTile} data-dimmed={dimmed} aria-hidden="true" />;
            const piece = isKnight ? 'knight' : tile.type === 'king' ? 'king' : tile.hasFire ? 'fire' : undefined;
            const label = [
              isKnight ? (tile.hasFire ? 'Knight on fire tile' : 'Knight') : tile.type === 'king' ? 'King' : tile.hasFire ? 'Fire tile' : 'Tile',
              `row ${r + 1}, column ${c + 1}`,
              isHintTarget ? 'suggested move' : valid ? 'available move' : '',
            ].filter(Boolean).join(', ');
            return <button type="button" key={`${r}-${c}`} className={classicStyles.tile}
              data-piece={piece} data-next={valid} data-hint={isHintTarget} data-dimmed={dimmed}
              data-burning={isKnight && tile.hasFire ? 'true' : undefined}
              aria-label={label} disabled={locked || !state.isPlaying || isKnight} onClick={() => onMove(r, c)}>
              {piece && <Image src={`/classic-tour/${piece}.svg`} alt="" fill unoptimized />}
              {valid && !piece && !isHintTarget && <span className={classicStyles.movePoint} aria-hidden="true" />}
            </button>;
          }
          return (
            <Tile
              key={`${r}-${c}`}
              tile={tile}
              isKnight={isKnight}
              isValidMove={valid}
              isHintTarget={isHintTarget}
              onClick={() => onMove(r, c)}
              showQuestValue={state.gameMode === 'math_tour'}
            />
          );
        })
      )}
    </div>
  );
}
