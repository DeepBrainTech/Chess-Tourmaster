import type { GameMode } from './types';
import type { LevelConfig, TileData } from './types';

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
  const resultGrid: TileData[][] = [];

  if (isMathTour) {
    // Math Tour: 全盘可走，无 void，保留加减法与乘法
    const kr = Math.floor(rng() * size);
    const kc = Math.floor(rng() * size);
    config.kingPos = { r: kr, c: kc };
    let sr: number, sc: number;
    do {
      sr = Math.floor(rng() * size);
      sc = Math.floor(rng() * size);
    } while (sr === kr && sc === kc);
    config.knightPos = { r: sr, c: sc };

    const fireChance = 0.1 + levelNum * 0.025;
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
        if (!isKing) {
          if (!isStart) {
            tilesToVisit++;
            if (rng() < 0.2) value = -(Math.floor(rng() * 3) + 1);
            else value = Math.floor(rng() * 4) + 2;
            if (rng() < 0.12) tileMultiplier = 2;
            else if (rng() < 0.04) tileMultiplier = 3;
            maxPossibleBaseScore += value * (tileMultiplier ?? 1);
            if (rng() < fireChance) hasFire = true;
          }
        }
        resultGrid[r][c] = { type, hasFire, visited: isStart, r, c, value, tileMultiplier };
      }
    }
    resultGrid[kr][kc].type = 'king';
    resultGrid[kr][kc].hasFire = false;
    config.initialScore = 0;
    config.requiredScore = Math.max(1, Math.floor(maxPossibleBaseScore * 0.5));
  } else {
    // Classic: 路径生成，部分格子为 void
    const grid = Array(size).fill(null).map(() => Array(size).fill(0));
    let maxPathLength = size * size;
    if (levelNum === 1) maxPathLength = 5;
    else if (levelNum === 2) maxPathLength = 8;
    else if (levelNum === 3) maxPathLength = 12;
    else if (levelNum === 4) maxPathLength = 18;

    let cr = Math.floor(rng() * size);
    let cc = Math.floor(rng() * size);
    config.kingPos = { r: cr, c: cc };
    let path = [{ r: cr, c: cc }];
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
    config.knightPos = { ...curr };

    const fireChance = 0.05 + levelNum * 0.02;
    for (let r = 0; r < size; r++) {
      resultGrid[r] = [];
      for (let c = 0; c < size; c++) {
        let type: TileData['type'] = 'empty';
        if (r === config.kingPos.r && c === config.kingPos.c) type = 'king';
        else if (grid[r][c] === 0) type = 'void';
        const isPath = grid[r][c] === 1;
        const isStart = r === config.knightPos.r && c === config.knightPos.c;
        const isKing = r === config.kingPos.r && c === config.kingPos.c;
        let hasFire = false;
        let value = 0;
        let tileMultiplier: number | undefined;
        if (isPath && !isStart && !isKing) {
          tilesToVisit++;
          if (rng() < fireChance) hasFire = true;
        }
        resultGrid[r][c] = { type, hasFire, visited: isStart, r, c, value, tileMultiplier };
      }
    }
    resultGrid[config.kingPos.r][config.kingPos.c].type = 'king';
    resultGrid[config.kingPos.r][config.kingPos.c].hasFire = false;
  }

  config.grid = resultGrid;
  config.tilesLeft = tilesToVisit;
  config.parTime = Math.max(5, tilesToVisit * 2.5);
  config.initialScore = isMathTour ? config.initialScore : 0;
  config.requiredScore = isMathTour ? config.requiredScore : 0;

  return config;
}

export { getValidMoves };
