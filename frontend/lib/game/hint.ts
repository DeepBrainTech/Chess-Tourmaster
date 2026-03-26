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

function getClassicHintMove(state: GameState): HintResult {
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

function isReachableMathTile(state: GameState, pos: Pos): boolean {
  const tile = state.grid[pos.r]?.[pos.c];
  if (!tile) return false;
  if (tile.type === 'void' || tile.type === 'king' || tile.visited) return false;
  return true;
}

function getMathMoveGain(state: GameState, pos: Pos): number {
  const tile = state.grid[pos.r]?.[pos.c];
  if (!tile || tile.type === 'void' || tile.type === 'king' || tile.visited) return Number.NEGATIVE_INFINITY;
  const tileMult = tile.tileMultiplier ?? 1;
  if (tileMult > 1) {
    return state.currentScore * (tileMult - 1);
  }
  return (tile.value ?? 0) * state.scoreMultiplier;
}

function canCaptureKingFrom(state: GameState, pos: Pos, score: number): boolean {
  if (score < state.requiredScore) return false;
  return nextKnightMoves(pos, state.gridSizeVal).some(
    move => move.r === state.kingPos.r && move.c === state.kingPos.c
  );
}

function hasFollowUpMove(state: GameState, from: Pos, consumed: Pos, scoreAfterMove: number): boolean {
  return nextKnightMoves(from, state.gridSizeVal).some((move) => {
    if (move.r === state.kingPos.r && move.c === state.kingPos.c) {
      return scoreAfterMove >= state.requiredScore;
    }
    if (move.r === consumed.r && move.c === consumed.c) return false;
    return isReachableMathTile(state, move);
  });
}

function getMathHintMove(state: GameState): HintResult {
  const immediateKing = nextKnightMoves(state.knightPos, state.gridSizeVal).find(
    move => move.r === state.kingPos.r && move.c === state.kingPos.c
  );
  if (immediateKing && state.currentScore >= state.requiredScore) {
    return { type: 'next_move', move: immediateKing };
  }

  const candidates = nextKnightMoves(state.knightPos, state.gridSizeVal).filter(
    move => isReachableMathTile(state, move)
  );
  if (candidates.length === 0) {
    return { type: 'no_win_path' };
  }

  const scored = candidates.map((move) => {
    const gain = getMathMoveGain(state, move);
    const nextScore = state.currentScore + gain;
    const canCaptureAfterThisMove = canCaptureKingFrom(state, move, nextScore);
    const hasFollowUp = hasFollowUpMove(state, move, move, nextScore);
    const mobility = nextKnightMoves(move, state.gridSizeVal).filter((next) => {
      if (next.r === state.kingPos.r && next.c === state.kingPos.c) return nextScore >= state.requiredScore;
      if (next.r === move.r && next.c === move.c) return false;
      return isReachableMathTile(state, next);
    }).length;
    return {
      move,
      gain,
      nextScore,
      canCaptureAfterThisMove,
      hasFollowUp,
      mobility,
    };
  });

  scored.sort((a, b) => {
    if (a.canCaptureAfterThisMove !== b.canCaptureAfterThisMove) {
      return a.canCaptureAfterThisMove ? -1 : 1;
    }
    if (a.hasFollowUp !== b.hasFollowUp) {
      return a.hasFollowUp ? -1 : 1;
    }
    if (a.nextScore !== b.nextScore) {
      return b.nextScore - a.nextScore;
    }
    if (a.mobility !== b.mobility) {
      return b.mobility - a.mobility;
    }
    return b.gain - a.gain;
  });

  return { type: 'next_move', move: scored[0].move };
}

export function getHintMove(state: GameState): HintResult {
  if (!state.isPlaying || state.grid.length === 0) {
    return { type: 'no_win_path' };
  }
  if (state.gameMode === 'math_tour') {
    return getMathHintMove(state);
  }
  return getClassicHintMove(state);
}
