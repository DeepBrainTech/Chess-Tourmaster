import type { GameMode } from './types';
import type { LevelConfig, TileData } from './types';
import { MATH_PIECE_CONFIG, type MathPiece } from './types';

/** Weighted pick: more pawns, fewer queens, to keep requiredScore achievable. */
function pickRandomMathPiece(rng: () => number): MathPiece {
  const roll = rng();
  if (roll < 0.35) return 'pawn';
  if (roll < 0.58) return 'knight';
  if (roll < 0.76) return 'bishop';
  if (roll < 0.90) return 'rook';
  return 'queen';
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getValidMoves(r: number, c: number, size: number): { r: number; c: number }[] {
  const moves = [
    { r: r - 2, c: c - 1 }, { r: r - 2, c: c + 1 },
    { r: r - 1, c: c - 2 }, { r: r - 1, c: c + 2 },
    { r: r + 1, c: c - 2 }, { r: r + 1, c: c + 2 },
    { r: r + 2, c: c - 1 }, { r: r + 2, c: c + 1 },
  ];
  return moves.filter(m => m.r >= 0 && m.r < size && m.c >= 0 && m.c < size);
}

function getClassicTargetPathLength(levelNum: number, size: number): number {
  const cap = size * size - 2;
  if (levelNum <= 15) {
    // 5x5: 5 -> 19
    return Math.min(cap, 4 + levelNum);
  }
  if (levelNum <= 30) {
    // 6x6: step down on board-size jump, then rise 16 -> 30
    return Math.min(cap, 15 + (levelNum - 15));
  }
  // 7x7: another step down, then slower long-tail growth
  return Math.min(cap, 24 + Math.floor((levelNum - 31) * 0.35));
}
function getClassicFireChance(levelNum: number): number {
  if (levelNum <= 15) {
    // 0.07 -> 0.20
    return Math.min(0.20, 0.07 + (levelNum - 1) * ((0.20 - 0.07) / 14));
  }
  if (levelNum <= 30) {
    // 0.18 -> 0.28
    return Math.min(0.28, 0.18 + (levelNum - 16) * ((0.28 - 0.18) / 14));
  }
  // 0.22 -> 0.33
  return Math.min(0.33, 0.22 + (levelNum - 31) * ((0.33 - 0.22) / 69));
}

function getMathFireChance(levelNum: number): number {
  if (levelNum <= 15) {
    // 0.10 -> 0.20
    return Math.min(0.20, 0.10 + (levelNum - 1) * ((0.20 - 0.10) / 14));
  }
  if (levelNum <= 30) {
    // 0.18 -> 0.28
    return Math.min(0.28, 0.18 + (levelNum - 16) * ((0.28 - 0.18) / 14));
  }
  // 0.24 -> 0.35
  return Math.min(0.35, 0.24 + (levelNum - 31) * ((0.35 - 0.24) / 69));
}

function getMathRequiredRatio(levelNum: number): number {
  if (levelNum <= 15) return 0.65;
  if (levelNum <= 30) return 0.78;
  if (levelNum <= 60) return 0.90;
  return 1.00;
}

function getMathRequiredBaseFloor(levelNum: number): number {
  if (levelNum <= 15) return 35;
  if (levelNum <= 30) return 50;
  if (levelNum <= 60) return 65;
  return 80;
}

function getMathFireWeight(levelNum: number): number {
  if (levelNum <= 15) return 6;
  if (levelNum <= 30) return 7;
  if (levelNum <= 60) return 8;
  return 9;
}

function getMathQueenWeight(levelNum: number): number {
  if (levelNum <= 15) return 4;
  if (levelNum <= 30) return 5;
  if (levelNum <= 60) return 6;
  return 7;
}

function canReachKingApproach(
  grid: TileData[][],
  start: { r: number; c: number },
  king: { r: number; c: number },
  size: number
): boolean {
  const queue: Array<{ r: number; c: number }> = [{ ...start }];
  const visited = new Set<string>([`${start.r},${start.c}`]);

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr) break;
    for (const move of getValidMoves(curr.r, curr.c, size)) {
      if (move.r === king.r && move.c === king.c) continue;
      const tile = grid[move.r]?.[move.c];
      if (!tile || tile.type === 'void' || tile.type === 'king') continue;
      const key = `${move.r},${move.c}`;
      if (visited.has(key)) continue;
      if (getValidMoves(move.r, move.c, size).some((m) => m.r === king.r && m.c === king.c)) {
        return true;
      }
      visited.add(key);
      queue.push(move);
    }
  }
  return false;
}

function estimateMathCapturableScore(
  grid: TileData[][],
  start: { r: number; c: number },
  king: { r: number; c: number },
  size: number
): number {
  const tileIndex = new Map<string, number>();
  let index = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r === king.r && c === king.c) continue;
      if (r === start.r && c === start.c) continue;
      const tile = grid[r]?.[c];
      if (!tile || tile.type === 'void' || tile.type === 'king') continue;
      tileIndex.set(`${r},${c}`, index++);
    }
  }

  type SearchState = { r: number; c: number; score: number; visitedMask: bigint };
  const BEAM_WIDTH = 80;
  let beam: SearchState[] = [{ r: start.r, c: start.c, score: 0, visitedMask: 0n }];
  let bestCapturable = getValidMoves(start.r, start.c, size).some((m) => m.r === king.r && m.c === king.c)
    ? 0
    : Number.NEGATIVE_INFINITY;

  const maxDepth = tileIndex.size;
  for (let depth = 0; depth < maxDepth; depth++) {
    const nextMap = new Map<string, SearchState>();
    for (const state of beam) {
      for (const move of getValidMoves(state.r, state.c, size)) {
        if (move.r === king.r && move.c === king.c) continue;
        const tile = grid[move.r]?.[move.c];
        if (!tile || tile.type === 'void' || tile.type === 'king') continue;
        const idx = tileIndex.get(`${move.r},${move.c}`);
        if (idx == null) continue;
        const bit = 1n << BigInt(idx);
        if ((state.visitedMask & bit) !== 0n) continue;
        const tileMult = tile.tileMultiplier ?? 1;
        const nextScore = tileMult > 1 ? state.score * tileMult : state.score + (tile.value ?? 0);
        const nextVisitedMask = state.visitedMask | bit;
        const key = `${move.r},${move.c},${nextVisitedMask.toString()}`;
        const prev = nextMap.get(key);
        if (!prev || nextScore > prev.score) {
          nextMap.set(key, { r: move.r, c: move.c, score: nextScore, visitedMask: nextVisitedMask });
        }
      }
    }

    if (nextMap.size === 0) break;
    const nextStates = Array.from(nextMap.values());
    for (const state of nextStates) {
      const canCapture = getValidMoves(state.r, state.c, size).some((m) => m.r === king.r && m.c === king.c);
      if (canCapture && state.score > bestCapturable) {
        bestCapturable = state.score;
      }
    }

    nextStates.sort((a, b) => {
      const aCanCapture = getValidMoves(a.r, a.c, size).some((m) => m.r === king.r && m.c === king.c);
      const bCanCapture = getValidMoves(b.r, b.c, size).some((m) => m.r === king.r && m.c === king.c);
      if (aCanCapture !== bCanCapture) return aCanCapture ? -1 : 1;
      return b.score - a.score;
    });
    beam = nextStates.slice(0, BEAM_WIDTH);
  }

  return Number.isFinite(bestCapturable) ? Math.floor(bestCapturable) : 0;
}

function countNeighborFire(grid: TileData[][], r: number, c: number): number {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= grid.length || cc < 0 || cc >= grid.length) continue;
      if (grid[rr]?.[cc]?.hasFire) count++;
    }
  }
  return count;
}

function estimateClassicParTime(tilesToVisit: number, fireCount: number, size: number): number {
  const sizeBonus = size === 7 ? 4 : size === 6 ? 2 : 0;
  return Math.max(8, Math.round(tilesToVisit * 2.2 + fireCount * 1.1 + sizeBonus));
}

function buildClassicConfig(
  levelNum: number,
  size: number,
  rng: () => number
): {
  grid: TileData[][];
  kingPos: { r: number; c: number };
  knightPos: { r: number; c: number };
  tilesToVisit: number;
  fireCount: number;
} {
  const grid = Array(size).fill(null).map(() => Array(size).fill(0));
  const maxPathLength = getClassicTargetPathLength(levelNum, size);

  const cr = Math.floor(rng() * size);
  const cc = Math.floor(rng() * size);
  const kingPos = { r: cr, c: cc };
  const path = [{ r: cr, c: cc }];
  grid[cr][cc] = 1;
  let curr = { r: cr, c: cc };
  let attempts = 1000;
  while (path.length < maxPathLength && attempts > 0) {
    const moves = getValidMoves(curr.r, curr.c, size);
    const validNext = moves.filter(m => grid[m.r][m.c] === 0);
    if (validNext.length === 0) break;
    const next = validNext[Math.floor(rng() * validNext.length)];
    grid[next.r][next.c] = 1;
    path.push(next);
    curr = next;
    attempts--;
  }
  if (path.length < maxPathLength) {
    curr = path[Math.floor(rng() * path.length)];
    attempts = 1000;
    while (path.length < maxPathLength && attempts > 0) {
      const moves = getValidMoves(curr.r, curr.c, size);
      const validNext = moves.filter(m => grid[m.r][m.c] === 0);
      if (validNext.length === 0) {
        curr = path[Math.floor(rng() * path.length)];
        attempts--;
        continue;
      }
      const next = validNext[Math.floor(rng() * validNext.length)];
      grid[next.r][next.c] = 1;
      path.push(next);
      curr = next;
      attempts--;
    }
  }

  const knightPos = { ...curr };
  const fireChance = getClassicFireChance(levelNum);
  let tilesToVisit = 0;
  let fireCount = 0;
  const resultGrid: TileData[][] = [];
  for (let r = 0; r < size; r++) {
    resultGrid[r] = [];
    for (let c = 0; c < size; c++) {
      let type: TileData['type'] = 'empty';
      if (r === kingPos.r && c === kingPos.c) type = 'king';
      else if (grid[r][c] === 0) type = 'void';
      const isPath = grid[r][c] === 1;
      const isStart = r === knightPos.r && c === knightPos.c;
      const isKing = r === kingPos.r && c === kingPos.c;
      let hasFire = false;
      const value = 0;
      let tileMultiplier: number | undefined;
      if (isPath && !isStart && !isKing) {
        tilesToVisit++;
        const neighborFireCount = countNeighborFire(resultGrid, r, c);
        if (rng() < fireChance && neighborFireCount < 2) {
          hasFire = true;
          fireCount++;
        }
      }
      resultGrid[r][c] = { type, hasFire, visited: isStart, r, c, value, tileMultiplier };
    }
  }
  resultGrid[kingPos.r][kingPos.c].type = 'king';
  resultGrid[kingPos.r][kingPos.c].hasFire = false;

  return { grid: resultGrid, kingPos, knightPos, tilesToVisit, fireCount };
}

function isClassicLayoutQualityOk(
  grid: TileData[][],
  knightPos: { r: number; c: number },
  kingPos: { r: number; c: number },
  tilesToVisit: number,
  fireCount: number,
  size: number
): boolean {
  if (tilesToVisit < Math.max(4, Math.floor(size * size * 0.4))) return false;
  const fireDensity = tilesToVisit > 0 ? fireCount / tilesToVisit : 0;
  if (fireDensity < 0.08 || fireDensity > 0.35) return false;

  const openingMoves = getValidMoves(knightPos.r, knightPos.c, size).filter((m) => {
    const tile = grid[m.r]?.[m.c];
    return !!tile && tile.type !== 'void' && !tile.visited;
  }).length;
  if (openingMoves < 2) return false;

  const kingApproaches = getValidMoves(kingPos.r, kingPos.c, size).filter((m) => {
    const tile = grid[m.r]?.[m.c];
    return !!tile && tile.type !== 'void';
  }).length;
  return kingApproaches >= 2;
}

function buildMathTourConfig(
  levelNum: number,
  size: number,
  rng: () => number
): {
  grid: TileData[][];
  kingPos: { r: number; c: number };
  knightPos: { r: number; c: number };
  tilesToVisit: number;
  maxPossibleBaseScore: number;
  fireCount: number;
  scoringTiles: number;
  bishopTiles: number;
  kingLandingCount: number;
  kingApproachReachable: boolean;
  requiredScore: number;
} {
  const kr = Math.floor(rng() * size);
  const kc = Math.floor(rng() * size);
  const kingPos = { r: kr, c: kc };
  let sr: number;
  let sc: number;
  do {
    sr = Math.floor(rng() * size);
    sc = Math.floor(rng() * size);
  } while (sr === kr && sc === kc);
  const knightPos = { r: sr, c: sc };

  let maxPossibleBaseScore = 0;
  let tilesToVisit = 0;
  let fireCount = 0;
  let scoringTiles = 0;
  let bishopTiles = 0;
  let queenTiles = 0;
  const resultGrid: TileData[][] = [];
  const fireChance = getMathFireChance(levelNum);

  for (let r = 0; r < size; r++) {
    resultGrid[r] = [];
    for (let c = 0; c < size; c++) {
      const isKing = r === kr && c === kc;
      const isStart = r === sr && c === sc;
      let type: TileData['type'] = 'empty';
      if (isKing) type = 'king';
      let value = 0;
      let hasFire = false;
      let tileMultiplier: number | undefined;
      let piece: MathPiece | undefined;
      if (!isKing && !isStart) {
        tilesToVisit++;
        if (rng() < fireChance) {
          hasFire = true;
          tileMultiplier = 3;
          fireCount++;
        } else {
          piece = pickRandomMathPiece(rng);
          const cfg = MATH_PIECE_CONFIG[piece];
          value = cfg.value;
          tileMultiplier = cfg.tileMultiplier;
          maxPossibleBaseScore += value * tileMultiplier;
          scoringTiles++;
          if (piece === 'bishop') bishopTiles++;
          if (piece === 'queen') queenTiles++;
        }
      }
      resultGrid[r][c] = { type, hasFire, visited: isStart, r, c, value, tileMultiplier, piece };
    }
  }

  resultGrid[kr][kc].type = 'king';
  resultGrid[kr][kc].hasFire = false;

  const kingLandingCount = getValidMoves(kr, kc, size).filter((m) => {
    if (m.r === sr && m.c === sc) return false;
    return resultGrid[m.r]?.[m.c]?.type !== 'king';
  }).length;
  const kingApproachReachable = canReachKingApproach(resultGrid, knightPos, kingPos, size);

  const effectiveBase = maxPossibleBaseScore + tilesToVisit;
  const weightedRequired = Math.floor(
    effectiveBase * getMathRequiredRatio(levelNum)
      + fireCount * getMathFireWeight(levelNum)
      + queenTiles * getMathQueenWeight(levelNum)
  );
  const baseRequiredScore = Math.max(getMathRequiredBaseFloor(levelNum), Math.max(1, weightedRequired));
  const capturableScore = estimateMathCapturableScore(resultGrid, knightPos, kingPos, size);
  const requiredScore = Math.max(1, Math.min(baseRequiredScore, capturableScore));

  return {
    grid: resultGrid,
    kingPos,
    knightPos,
    tilesToVisit,
    maxPossibleBaseScore,
    fireCount,
    scoringTiles,
    bishopTiles,
    kingLandingCount,
    kingApproachReachable,
    requiredScore,
  };
}

function isMathTourLayoutQualityOk(candidate: ReturnType<typeof buildMathTourConfig>): boolean {
  const { tilesToVisit, fireCount, scoringTiles, bishopTiles, kingLandingCount, kingApproachReachable, requiredScore } = candidate;
  if (tilesToVisit <= 0 || scoringTiles <= 0) return false;

  const fireDensity = fireCount / tilesToVisit;
  if (fireDensity < 0.12 || fireDensity > 0.4) return false;

  const bishopRatio = bishopTiles / scoringTiles;
  if (bishopRatio > 0.35) return false;

  if (kingLandingCount < 2) return false;
  if (!kingApproachReachable) return false;
  return requiredScore >= 1;
}

export function generateLevelConfig(levelNum: number, gameMode: GameMode): LevelConfig {
  const seed = hashString(`tourmaster:${gameMode}:${levelNum}`);
  const rng = createRng(seed);

  const config: LevelConfig = {
    level: levelNum,
    grid: [],
    knightPos: { r: 0, c: 0 },
    kingPos: { r: 0, c: 0 },
    gridSizeVal: 5,
    tilesLeft: 0,
    parTime: 10,
    initialScore: 0,
    requiredScore: 0,
  };

  const isMathTour = gameMode === 'math_tour';
  config.gridSizeVal = levelNum > 15 ? 6 : 5;
  if (levelNum > 30) config.gridSizeVal = 7;

  const size = config.gridSizeVal;
  let maxPossibleBaseScore = 0;
  let tilesToVisit = 0;
  let fireCount = 0;
  const resultGrid: TileData[][] = [];

  if (isMathTour) {
    // Math Tour: full-board generation with quality checks (max 3 retries).
    const MAX_RETRY = 3;
    let fallbackMath: ReturnType<typeof buildMathTourConfig> | null = null;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const candidate = buildMathTourConfig(levelNum, size, rng);
      fallbackMath = candidate;
      if (isMathTourLayoutQualityOk(candidate)) {
        config.grid = candidate.grid;
        config.kingPos = candidate.kingPos;
        config.knightPos = candidate.knightPos;
        tilesToVisit = candidate.tilesToVisit;
        maxPossibleBaseScore = candidate.maxPossibleBaseScore;
        fireCount = candidate.fireCount;
        config.requiredScore = candidate.requiredScore;
        break;
      }
    }
    if (!config.grid.length && fallbackMath) {
      config.grid = fallbackMath.grid;
      config.kingPos = fallbackMath.kingPos;
      config.knightPos = fallbackMath.knightPos;
      tilesToVisit = fallbackMath.tilesToVisit;
      maxPossibleBaseScore = fallbackMath.maxPossibleBaseScore;
      fireCount = fallbackMath.fireCount;
      config.requiredScore = fallbackMath.requiredScore;
    }
    config.initialScore = 0;
  } else {
    // Classic: path generation with quality checks (max 5 retries).
    const MAX_RETRY = 5;
    let fallbackClassic: ReturnType<typeof buildClassicConfig> | null = null;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const candidate = buildClassicConfig(levelNum, size, rng);
      fallbackClassic = candidate;
      if (isClassicLayoutQualityOk(
        candidate.grid,
        candidate.knightPos,
        candidate.kingPos,
        candidate.tilesToVisit,
        candidate.fireCount,
        size
      )) {
        config.grid = candidate.grid;
        config.kingPos = candidate.kingPos;
        config.knightPos = candidate.knightPos;
        tilesToVisit = candidate.tilesToVisit;
        fireCount = candidate.fireCount;
        break;
      }
    }
    if (!config.grid.length && fallbackClassic) {
      config.grid = fallbackClassic.grid;
      config.kingPos = fallbackClassic.kingPos;
      config.knightPos = fallbackClassic.knightPos;
      tilesToVisit = fallbackClassic.tilesToVisit;
      fireCount = fallbackClassic.fireCount;
    }
  }

  config.tilesLeft = tilesToVisit;
  config.parTime = isMathTour
    ? Math.max(5, tilesToVisit * 2.5)
    : estimateClassicParTime(tilesToVisit, fireCount, size);
  config.initialScore = isMathTour ? config.initialScore : 0;
  config.requiredScore = isMathTour ? config.requiredScore : 0;

  return config;
}

export { getValidMoves };
