import type { GameMode, LevelConfig, MathPiece, Position, TileData } from './types';
import { MATH_PIECE_CONFIG } from './types';
import { getValidMoves } from './moves';
import { LEVEL_VERSION, MAX_LEVELS } from './rules';
import { optimisticMathScore } from './scoreBound';
export { getValidMoves } from './moves';

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Backtrack on a single simple path; never append branches to a stranded path.
function buildTour(size: number, rng: () => number): Position[] {
  const cells = size * size;
  const adjacent = Array.from({ length: cells }, (_, i) =>
    getValidMoves(Math.floor(i / size), i % size, size).map(p => p.r * size + p.c));
  for (let attempt = 0; attempt < 100; attempt++) {
    const used = new Set<number>();
    const path: number[] = [];
    let budget = 100000;
    function visit(cell: number): boolean {
      used.add(cell);
      path.push(cell);
      if (path.length === cells) return true;
      const candidates = adjacent[cell].filter(next => !used.has(next))
        .map(next => ({ next, degree: adjacent[next].filter(n => !used.has(n)).length, tie: rng() }))
        .sort((a, b) => a.degree - b.degree || a.tie - b.tie);
      for (const { next } of candidates) {
        if (--budget <= 0) break;
        if (visit(next)) return true;
      }
      used.delete(cell);
      path.pop();
      return false;
    }
    let start = Math.floor(rng() * cells);
    // Odd square tours must start on the majority color of the bipartite knight graph.
    if (size % 2 && (Math.floor(start / size) + start % size) % 2) start = (start + 1) % cells;
    if (visit(start)) return path.map(i => ({ r: Math.floor(i / size), c: i % size }));
  }
  throw new Error('Could not construct a certified knight tour');
}

export function generateLevelConfig(level: number, mode: GameMode): LevelConfig {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVELS || !['classic', 'math_tour'].includes(mode)) {
    throw new RangeError('Invalid level or game mode');
  }
  const size = level <= 15 ? 5 : level <= 30 ? 6 : 7;
  const rng = createRng(level * 7919 + (mode === 'math_tour' ? 104729 : 0) + LEVEL_VERSION * 65537);
  const tour = buildTour(size, rng);
  const count = level <= 15 ? 5 + level : level <= 30 ? 16 + level - 16 : Math.min(47, 25 + Math.floor((level - 31) * 0.32));
  const route = mode === 'classic' ? tour.slice(0, count) : tour;
  const knightPos = route[0];
  const kingPos = route[route.length - 1];
  const included = new Set(route.map(p => `${p.r},${p.c}`));
  const grid: TileData[][] = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ({
    r, c, type: included.has(`${r},${c}`) ? 'empty' : 'void',
    visited: r === knightPos.r && c === knightPos.c, hasFire: false, value: 0,
  })));
  grid[kingPos.r][kingPos.c].type = 'king';
  const scoring = route.slice(1, -1);
  let requiredScore = 0;
  if (mode === 'classic') {
    const fireCount = level <= 3 ? 0 : Math.max(1, Math.floor(scoring.length * (0.08 + level * 0.0012)));
    const shuffled = scoring.map(p => ({ p, rank: rng() })).sort((a, b) => a.rank - b.rank);
    for (const { p } of shuffled.slice(0, fireCount)) grid[p.r][p.c].hasFire = true;
  } else {
    // Scarce multipliers prevent the exponential growth caused by dense fire boards.
    const fireCount = level <= 3 ? 0 : 1 + Math.floor(level / 35);
    const queenCount = 1 + Math.floor(level / 50);
    const multiplierIndices = new Set<number>();
    for (let i = 0; i < fireCount + queenCount; i++) {
      multiplierIndices.add(Math.floor(scoring.length * 0.55 + i * scoring.length * 0.4 / (fireCount + queenCount)));
    }
    for (let attempt = 0; attempt < 100; attempt++) {
      let score = 0;
      let multiplier = 0;
      scoring.forEach((p, i) => {
        const tile = grid[p.r][p.c];
        tile.value = 0;
        tile.hasFire = false;
        tile.piece = undefined;
        if (multiplierIndices.has(i)) {
          tile.hasFire = multiplier++ < fireCount;
          tile.tileMultiplier = tile.hasFire ? 3 : 2;
          if (!tile.hasFire) tile.piece = 'queen';
          score *= tile.tileMultiplier;
        } else {
          const roll = rng();
          const piece: MathPiece = roll < 0.38 ? 'pawn' : roll < 0.65 ? 'knight' : roll < 0.85 ? 'rook' : 'bishop';
          tile.piece = piece;
          tile.value = MATH_PIECE_CONFIG[piece].value;
          tile.tileMultiplier = 1;
          score += tile.value;
        }
      });
      const minimumScoringMoves = 5 + Math.floor(level * 0.08);
      requiredScore = Math.max(optimisticMathScore(grid, minimumScoringMoves - 1) + 1,
        Math.floor(score * (0.35 + level * 0.0045)));
      // Keep the original board acceptance rule so fixed levels keep their existing tiles.
      if (score >= requiredScore * 1.2) break;
      if (attempt === 99) throw new Error('Could not certify math difficulty and three-star route');
    }
  }
  const fireCount = grid.flat().filter(t => t.hasFire).length;
  return {
    level, grid, knightPos: { ...knightPos }, kingPos: { ...kingPos }, gridSizeVal: size,
    tilesLeft: scoring.length, initialScore: 0, requiredScore,
    parTime: Math.max(level <= 3 ? 25 : 18, Math.round(scoring.length * 2.8 + fireCount * 1.2 + size)),
    solution: route.slice(1).map(p => ({ ...p })),
  };
}
