'use client';

import type { GameState } from '@/lib/game/types';
import { isValidMove } from '@/lib/game/gameReducer';
import MathTile from './MathTile';
import FireTileEffect, { type FireTileState } from './FireTileEffect';
import Image from 'next/image';
import classicStyles from './Tour.module.css';

type Props = {
  state: GameState;
  onMove: (r: number, c: number) => void;
  shake: boolean;
  hintTarget: { r: number; c: number } | null;
  locked?: boolean;
  showNextMoves?: boolean;
  fire?: FireTileState;
};

export default function Board({ state, onMove, shake, hintTarget, locked = false, showNextMoves = true, fire }: Props) {
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
      role="group"
      aria-label={classic ? 'Classic Tour chessboard' : 'Math Tour chessboard'}
      className={`${classicStyles.board} ${shake ? 'shake' : ''}`}
      data-shake={shake ? 'true' : undefined}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {state.grid.flatMap((row, r) =>
        row.map((tile, c) => {
          const isKnight =
            state.knightPos.r === r && state.knightPos.c === c;
          const fireEffect = isKnight && tile.hasFire ? fire : undefined;
          const valid =
            showNextMoves && state.isPlaying &&
            !locked &&
            isValidMove(state, r, c);
          const isHintTarget =
            hintTarget != null &&
            hintTarget.r === r &&
            hintTarget.c === c;
          const dimmed = hintTarget != null && !isKnight && !isHintTarget;
          if (classic) {
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
              {fireEffect && <FireTileEffect {...fireEffect} />}
              {piece && <Image src={`/classic-tour/${piece}.svg`} alt="" fill unoptimized />}
              {valid && !piece && !isHintTarget && <span className={classicStyles.movePoint} aria-hidden="true" />}
            </button>;
          }
          return (
            <MathTile
              key={`${r}-${c}`}
              tile={tile}
              isKnight={isKnight}
              valid={valid}
              hinted={isHintTarget}
              dimmed={dimmed}
              locked={locked || !state.isPlaying}
              onMove={onMove}
              fire={fireEffect}
            />
          );
        })
      )}
    </div>
  );
}
