import type { Position } from './types';

export function getValidMoves(r: number, c: number, size: number): Position[] {
  return [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
    .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
    .filter(p => p.r >= 0 && p.c >= 0 && p.r < size && p.c < size);
}

export const samePosition = (a: Position, b: Position) => a.r === b.r && a.c === b.c;
