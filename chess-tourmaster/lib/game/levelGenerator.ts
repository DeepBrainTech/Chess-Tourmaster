import type { GameMode } from './types';
import type { LevelConfig, TileData } from './types';
import { MATH_PIECE_CONFIG, type MathPiece } from './types';

/** 权重: pawn 多, queen 少，保证 requiredScore 可达成 */
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
  const cap = size * size;
  if (levelNum <= 1) return Math.min(cap, 5);
  if (levelNum <= 2) return Math.min(cap, 8);
  if (levelNum <= 3) return Math.min(cap, 12);
  if (levelNum <= 4) return Math.min(cap, 18);
  // Lv5+ 平滑增长，避免从固定值突跳到满盘
  return Math.min(cap - 2, 18 + (levelNum - 4));
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
  const fireChance = Math.min(0.35, 0.05 + levelNum * 0.02);
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

function clampRequiredScore(rawRequired: number, maxPossibleBaseScore: number, size: number): number {
  const minRatio = size === 7 ? 0.5 : size === 6 ? 0.45 : 0.4;
  const maxRatio = size === 7 ? 0.75 : size === 6 ? 0.72 : 0.7;
  const minRequired = Math.max(1, Math.floor(maxPossibleBaseScore * minRatio));
  const maxRequired = Math.max(minRequired, Math.floor(maxPossibleBaseScore * maxRatio));
  return Math.min(maxRequired, Math.max(minRequired, rawRequired));
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
  const resultGrid: TileData[][] = [];
  const fireChance = Math.min(0.45, 0.1 + levelNum * 0.025);

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

  const rawRequired = Math.max(1, Math.floor(maxPossibleBaseScore * 0.6));
  const requiredScore = clampRequiredScore(rawRequired, maxPossibleBaseScore, size);

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
    requiredScore,
  };
}

function isMathTourLayoutQualityOk(candidate: ReturnType<typeof buildMathTourConfig>): boolean {
  const { tilesToVisit, fireCount, scoringTiles, bishopTiles, kingLandingCount } = candidate;
  if (tilesToVisit <= 0 || scoringTiles <= 0) return false;

  const fireDensity = fireCount / tilesToVisit;
  if (fireDensity < 0.12 || fireDensity > 0.4) return false;

  const bishopRatio = bishopTiles / scoringTiles;
  if (bishopRatio > 0.35) return false;

  return kingLandingCount >= 2;
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
  config.gridSizeVal = levelNum > 5 ? 6 : 5;
  if (levelNum > 8) config.gridSizeVal = 7;

  const size = config.gridSizeVal;
  let maxPossibleBaseScore = 0;
  let tilesToVisit = 0;
  let fireCount = 0;
  const resultGrid: TileData[][] = [];

  if (isMathTour) {
    // Math Tour: 带质量检查的全盘生成（最多重试3次）
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
    // Classic: 带质量检查的路径生成（最多重试5次）
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
