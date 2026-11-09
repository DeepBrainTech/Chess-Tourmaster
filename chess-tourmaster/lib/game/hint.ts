import type { GameState, Position } from './types';
import { gameReducer, isValidMove } from './gameReducer';
import { getValidMoves, samePosition } from './moves';

export type HintResult = { type: 'next_move'; move: Position }
  | { type: 'no_win_path' } | { type: 'search_exhausted' };

const countBits = (mask: bigint): number => {
  let count = 0;
  while (mask) { mask &= mask - 1n; count++; }
  return count;
};

// Validate the entire suffix against the current board, including off-route moves/undos.
function certifiedSuffix(state: GameState): Position[] | null {
  if (!state.solution) return null;
  const index = state.solution.findIndex(p => samePosition(p, state.knightPos));
  const suffix = state.solution.slice(index + 1);
  let next = state;
  for (const p of suffix) {
    if (!isValidMove(next, p.r, p.c)) return null;
    next = gameReducer(next, { type: 'MOVE', payload: p });
  }
  return samePosition(next.knightPos, next.kingPos) && !next.isPlaying ? suffix : null;
}

export function getHintMove(state: GameState, nodeBudget = 150000): HintResult {
  if (!state.isPlaying || !state.grid.length) return { type: 'no_win_path' };
  for (const move of getValidMoves(state.knightPos.r, state.knightPos.c, state.gridSizeVal)) {
    if (samePosition(move, state.kingPos) && isValidMove(state, move.r, move.c)) return { type: 'next_move', move };
  }
  const suffix = certifiedSuffix(state);
  if (suffix?.length) return { type: 'next_move', move: suffix[0] };

  const tiles = state.grid.flat().filter(t => t.type !== 'void' && (!t.visited || samePosition(t, state.knightPos)));
  const index = new Map(tiles.map((t, i) => [`${t.r},${t.c}`, i]));
  const bits = tiles.map((_, i) => 1n << BigInt(i));
  const adjacent = tiles.map(t => getValidMoves(t.r, t.c, state.gridSizeVal)
    .map(p => index.get(`${p.r},${p.c}`)).filter((i): i is number => i !== undefined));
  const masks = adjacent.map(a => a.reduce((m, i) => m | bits[i], 0n));
  const start = index.get(`${state.knightPos.r},${state.knightPos.c}`)!;
  const end = index.get(`${state.kingPos.r},${state.kingPos.c}`)!;
  const all = (1n << BigInt(tiles.length)) - 1n;
  const math = state.gameMode === 'math_tour';
  const failed = new Map<string, number>();
  let exhausted = false;

  function search(current: number, remaining: bigint, score: number): number[] | null {
    if (--nodeBudget < 0) { exhausted = true; return null; }
    if ((masks[current] & bits[end]) && (math ? score >= state.requiredScore : remaining === bits[end])) return [end];
    const key = `${current}:${remaining}`;
    const previous = failed.get(key);
    if (previous !== undefined && (!math || previous >= score)) return null;
    let seen = bits[current];
    const queue = [current];
    for (let head = 0; head < queue.length; head++) {
      for (const v of adjacent[queue[head]]) {
        if (v !== end && (remaining & bits[v]) && !(seen & bits[v])) { seen |= bits[v]; queue.push(v); }
      }
    }
    if (!(seen & masks[end])) return null;
    if (!math) {
      if (((seen | bits[end]) & remaining) !== remaining) return null;
      for (let v = 0; v < tiles.length; v++) {
        if ((remaining & bits[v]) && countBits(masks[v] & (remaining | bits[current])) < (v === end ? 1 : 2)) return null;
      }
    }
    const candidates = adjacent[current].filter(v => v !== end && Boolean(remaining & bits[v]));
    const nextScore = (v: number) => (tiles[v].tileMultiplier ?? 1) > 1
      ? score * tiles[v].tileMultiplier! : score + tiles[v].value * state.scoreMultiplier;
    candidates.sort((a, b) => math ? nextScore(b) - nextScore(a) : countBits(masks[a] & remaining) - countBits(masks[b] & remaining));
    for (const v of candidates) {
      const path = search(v, remaining & ~bits[v], math ? nextScore(v) : 0);
      if (path) return [v, ...path];
      if (exhausted) return null;
    }
    failed.set(key, score);
    return null;
  }
  const path = search(start, all & ~bits[start], state.currentScore);
  if (!path) return { type: exhausted ? 'search_exhausted' : 'no_win_path' };
  return { type: 'next_move', move: { r: tiles[path[0]].r, c: tiles[path[0]].c } };
}
