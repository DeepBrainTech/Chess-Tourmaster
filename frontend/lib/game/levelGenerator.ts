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

  config.gridSizeVal = levelNum > 5 ? 6 : 5;
  if (levelNum > 8) config.gridSizeVal = 7;

  const size = config.gridSizeVal;
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

  let maxPossibleBaseScore = 0;
  let tilesToVisit = 0;

  const resultGrid: TileData[][] = [];
  for (let r = 0; r < size; r++) {
    resultGrid[r] = [];
    for (let c = 0; c < size; c++) {
      let type: TileData['type'] = 'empty';
      if (r === config.kingPos.r && c === config.kingPos.c) type = 'king';
      else if (grid[r][c] === 0) type = 'void';

      let hasFire = false;
      const isPath = grid[r][c] === 1;
      const isStart = r === config.knightPos.r && c === config.knightPos.c;
      const isKing = r === config.kingPos.r && c === config.kingPos.c;
      let value = 0;

      if (isPath && !isStart && !isKing) {
        tilesToVisit++;
        if (rng() < (0.05 + levelNum * 0.02)) hasFire = true;
        if (gameMode === 'math_tour') {
          value = Math.floor(rng() * 4) + 2;
          maxPossibleBaseScore += value;
        }
      }

      resultGrid[r][c] = {
        type,
        hasFire,
        visited: isStart,
        r,
        c,
        value,
      };
    }
  }

  config.grid = resultGrid;
  config.tilesLeft = tilesToVisit;
  config.parTime = Math.max(5, tilesToVisit * 2.5);
  config.initialScore = 0;
  config.requiredScore = 0;

  if (gameMode === 'math_tour') {
    const requiredScoreMultiplier = levelNum === 1 ? 2 : 4;
    const targetRequiredScore = Math.ceil(tilesToVisit * requiredScoreMultiplier);
    config.requiredScore = Math.min(targetRequiredScore, maxPossibleBaseScore);
    config.requiredScore = Math.max(1, config.requiredScore);
    const startTile = config.grid[config.knightPos.r][config.knightPos.c];
    config.initialScore = startTile.value;
    startTile.value = 0;
  }

  config.grid[config.kingPos.r][config.kingPos.c].type = 'king';
  config.grid[config.kingPos.r][config.kingPos.c].hasFire = false;

  return config;
}

export { getValidMoves };
