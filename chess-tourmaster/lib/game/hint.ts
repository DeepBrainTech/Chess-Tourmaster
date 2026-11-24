import type { GameState, Position } from './types';
import { gameReducer, isValidMove } from './gameReducer';
import { getValidMoves, samePosition } from './moves';
import { getMathStarTargets } from './rules';

export type HintResult = { type: 'next_move'; move: Position }
  | { type: 'no_win_path' } | { type: 'search_exhausted' };

const countBits = (mask: bigint): number => {
  let count = 0;
  while (mask) { mask &= mask - 1n; count++; }
  return count;
};

// Validate the entire suffix against the current board, including off-route moves/undos.
function certifiedFinish(state: GameState): { move: Position; score: number } | null {
  if (!state.solution) return null;
  const index = state.solution.findIndex(p => samePosition(p, state.knightPos));
  const suffix = state.solution.slice(index + 1);
  let next = state;
  for (const p of suffix) {
    if (!isValidMove(next, p.r, p.c)) return null;
    next = gameReducer(next, { type: 'MOVE', payload: p });
  }
  return suffix.length && samePosition(next.knightPos, next.kingPos) && !next.isPlaying
    ? { move: suffix[0], score: next.currentScore } : null;
}

export function getHintMove(state: GameState, nodeBudget = 150000): HintResult {
  if (!state.isPlaying || !state.grid.length) return { type: 'no_win_path' };
  const math = state.gameMode === 'math_tour';
  const [oneStarTarget, , threeStarTarget] = getMathStarTargets(state.requiredScore);
  let best: { move: Position; score: number } | null = null;
  if (isValidMove(state, state.kingPos.r, state.kingPos.c)) {
    const move = state.kingPos;
    if (!math || state.currentScore >= threeStarTarget) return { type: 'next_move', move };
    best = { move, score: state.currentScore };
  }
  const certified = certifiedFinish(state);
  if (certified) {
    if (!math || certified.score >= threeStarTarget) return { type: 'next_move', move: certified.move };
    if (!best || certified.score > best.score) best = certified;
  }

  const tiles = state.grid.flat().filter(t => t.type !== 'void' && (!t.visited || samePosition(t, state.knightPos)));
  const index = new Map(tiles.map((t, i) => [`${t.r},${t.c}`, i]));
  const bits = tiles.map((_, i) => 1n << BigInt(i));
  const adjacent = tiles.map(t => getValidMoves(t.r, t.c, state.gridSizeVal)
    .map(p => index.get(`${p.r},${p.c}`)).filter((i): i is number => i !== undefined));
  const masks = adjacent.map(a => a.reduce((m, i) => m | bits[i], 0n));
  const start = index.get(`${state.knightPos.r},${state.knightPos.c}`)!;
  const end = index.get(`${state.kingPos.r},${state.kingPos.c}`)!;
  const all = (1n << BigInt(tiles.length)) - 1n;
  const explored = new Map<string, number>();
  let exhausted = false;

  function search(current: number, remaining: bigint, score: number, first?: Position): boolean {
    if (--nodeBudget < 0) { exhausted = true; return false; }
    if ((masks[current] & bits[end]) && (math ? score >= oneStarTarget : remaining === bits[end])) {
      if (!best || score > best.score) best = { move: first ?? state.kingPos, score };
      if (!math || score >= threeStarTarget) return true;
    }
    const key = `${current}:${remaining}`;
    const previous = explored.get(key);
    // Every score operation is monotone, so a lower score cannot improve the same continuation.
    if (previous !== undefined && previous >= score) return false;
    explored.set(key, score);
    let seen = bits[current];
    const queue = [current];
    for (let head = 0; head < queue.length; head++) {
      for (const v of adjacent[queue[head]]) {
        if (v !== end && (remaining & bits[v]) && !(seen & bits[v])) { seen |= bits[v]; queue.push(v); }
      }
    }
    if (!(seen & masks[end])) return false;
    if (math) {
      // Relax movement order by collecting all reachable positive points before every multiplier.
      let points = score;
      let multiplier = 1;
      for (let i = 1; i < queue.length; i++) {
        const tile = tiles[queue[i]];
        if ((tile.tileMultiplier ?? 1) > 1) multiplier *= tile.tileMultiplier!;
        else points += Math.max(0, tile.value) * (first ? 1 : Math.max(1, state.scoreMultiplier));
      }
      const upperBound = Math.max(0, points) * multiplier;
      if (upperBound < oneStarTarget || (best && upperBound <= best.score)) return false;
    } else {
      if (((seen | bits[end]) & remaining) !== remaining) return false;
      for (let v = 0; v < tiles.length; v++) {
        if ((remaining & bits[v]) && countBits(masks[v] & (remaining | bits[current])) < (v === end ? 1 : 2)) return false;
      }
    }
    const candidates = adjacent[current].filter(v => v !== end && Boolean(remaining & bits[v]));
    const nextScore = (v: number) => (tiles[v].tileMultiplier ?? 1) > 1
      ? score * tiles[v].tileMultiplier! : score + tiles[v].value * (first ? 1 : state.scoreMultiplier);
    candidates.sort((a, b) => math ? nextScore(b) - nextScore(a) : countBits(masks[a] & remaining) - countBits(masks[b] & remaining));
    for (const v of candidates) {
      const move = first ?? { r: tiles[v].r, c: tiles[v].c };
      if (search(v, remaining & ~bits[v], math ? nextScore(v) : 0, move)) return true;
      if (exhausted) return false;
    }
    return false;
  }
  search(start, all & ~bits[start], state.currentScore);
  return best ? { type: 'next_move', move: best.move } : { type: exhausted ? 'search_exhausted' : 'no_win_path' };
}
