'use client';

import type { GameState } from '@/lib/game/types';
import { isValidMove } from '@/lib/game/gameReducer';
import Tile from './Tile';

type Props = {
  state: GameState;
  onMove: (r: number, c: number) => void;
  shake: boolean;
};

export default function Board({ state, onMove, shake }: Props) {
  const size = state.gridSizeVal;

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
      className={`z-10 relative bg-slate-800/60 p-2 md:p-3 rounded-xl shadow-2xl border-4 border-slate-600 backdrop-blur-md w-full max-w-[95vw] md:max-w-2xl aspect-square flex items-center justify-center mx-auto grid gap-1 ${shake ? 'shake' : ''}`}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {state.grid.flatMap((row, r) =>
        row.map((tile, c) => {
          const isKnight =
            state.knightPos.r === r && state.knightPos.c === c;
          const valid =
            state.isPlaying &&
            isValidMove(state, r, c);
          return (
            <Tile
              key={`${r}-${c}`}
              tile={tile}
              isKnight={isKnight}
              isValidMove={valid}
              onClick={() => onMove(r, c)}
            />
          );
        })
      )}
    </div>
  );
}
