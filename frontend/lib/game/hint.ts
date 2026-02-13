import type { GameState } from './types';

type Pos = { r: number; c: number };

export type HintResult =
  | { type: 'next_move'; move: Pos }
  | { type: 'no_win_path' };

const KNIGHT_STEPS: Pos[] = [
  { r: -2, c: -1 },
  { r: -2, c: 1 },
  { r: -1, c: -2 },
  { r: -1, c: 2 },
  { r: 1, c: -2 },
  { r: 1, c: 2 },
  { r: 2, c: -1 },
  { r: 2, c: 1 },
];

function toKey(pos: Pos): string {
  return `${pos.r},${pos.c}`;
}

function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function nextKnightMoves(pos: Pos, size: number): Pos[] {
  const moves: Pos[] = [];
  for (const step of KNIGHT_STEPS) {
    const nr = pos.r + step.r;
    const nc = pos.c + step.c;
    if (inBounds(nr, nc, size)) {
      moves.push({ r: nr, c: nc });
    }
  }
  return moves;
}

export function getHintMove(state: GameState): HintResult {
  if (!state.isPlaying || state.grid.length === 0) {
    return { type: 'no_win_path' };
  }

  const size = state.gridSizeVal;
  const king = state.kingPos;
  const indexByPos = new Map<string, number>();
  let nextIndex = 0;
  let remainingMask = 0n;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const tile = state.grid[r]?.[c];
      if (!tile || tile.type === 'void' || tile.type === 'king') continue;
      const idx = nextIndex++;
      indexByPos.set(`${r},${c}`, idx);
      if (!tile.visited) {
        remainingMask |= 1n << BigInt(idx);
      }
    }
  }

  const memo = new Map<string, boolean>();

  function tileIsReachable(pos: Pos, mask: bigint): 'king' | 'target' | 'blocked' {
    const tile = state.grid[pos.r]?.[pos.c];
    if (!tile || tile.type === 'void') return 'blocked';
    if (tile.type === 'king') return mask === 0n ? 'king' : 'blocked';
    const idx = indexByPos.get(toKey(pos));
    if (idx == null) return 'blocked';
    const bit = 1n << BigInt(idx);
    return (mask & bit) !== 0n ? 'target' : 'blocked';
  }

  function onwardCount(pos: Pos, mask: bigint): number {
    let count = 0;
    for (const move of nextKnightMoves(pos, size)) {
      if (tileIsReachable(move, mask) !== 'blocked') count++;
    }
    return count;
  }

  function canWinFrom(pos: Pos, mask: bigint): boolean {
    const memoKey = `${pos.r},${pos.c}|${mask.toString()}`;
    const cached = memo.get(memoKey);
    if (cached != null) return cached;

    if (mask === 0n) {
      const canCaptureKingNow = nextKnightMoves(pos, size).some(
        move => move.r === king.r && move.c === king.c
      );
      memo.set(memoKey, canCaptureKingNow);
      return canCaptureKingNow;
    }

    const candidates: Array<{ pos: Pos; nextMask: bigint }> = [];
    for (const move of nextKnightMoves(pos, size)) {
      if (tileIsReachable(move, mask) !== 'target') continue;
      const idx = indexByPos.get(toKey(move));
      if (idx == null) continue;
      const bit = 1n << BigInt(idx);
      candidates.push({ pos: move, nextMask: mask & ~bit });
    }

    candidates.sort((a, b) => onwardCount(a.pos, a.nextMask) - onwardCount(b.pos, b.nextMask));

    for (const candidate of candidates) {
      if (canWinFrom(candidate.pos, candidate.nextMask)) {
        memo.set(memoKey, true);
        return true;
      }
    }

    memo.set(memoKey, false);
    return false;
  }

  const firstMoves: Array<{ pos: Pos; nextMask: bigint }> = [];
  for (const move of nextKnightMoves(state.knightPos, size)) {
    const kind = tileIsReachable(move, remainingMask);
    if (kind === 'king') {
      return { type: 'next_move', move };
    }
    if (kind === 'target') {
      const idx = indexByPos.get(toKey(move));
      if (idx == null) continue;
      const bit = 1n << BigInt(idx);
      firstMoves.push({ pos: move, nextMask: remainingMask & ~bit });
    }
  }

  firstMoves.sort((a, b) => onwardCount(a.pos, a.nextMask) - onwardCount(b.pos, b.nextMask));

  for (const candidate of firstMoves) {
    if (canWinFrom(candidate.pos, candidate.nextMask)) {
      return { type: 'next_move', move: candidate.pos };
    }
  }

  return { type: 'no_win_path' };
}
