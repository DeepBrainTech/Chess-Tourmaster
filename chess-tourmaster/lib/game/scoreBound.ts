import type { TileData } from './types';

// Relax board geometry and put all additions before the largest multipliers.
// This overestimates every legal route of at most `moves` scoring landings.
export function optimisticMathScore(grid: TileData[][], moves: number): number {
  const available = grid.flat().filter(t => !t.visited && t.type === 'empty');
  const additions = available.filter(t => (t.tileMultiplier ?? 1) === 1 && t.value > 0)
    .map(t => t.value).sort((a, b) => b - a);
  const multipliers = available.filter(t => (t.tileMultiplier ?? 1) > 1)
    .map(t => t.tileMultiplier!).sort((a, b) => b - a);
  let best = 0;
  let product = 1;
  for (let count = 0; count <= Math.min(moves, multipliers.length); count++) {
    if (count) product *= multipliers[count - 1];
    best = Math.max(best, additions.slice(0, moves - count).reduce((sum, value) => sum + value, 0) * product);
  }
  return best;
}
