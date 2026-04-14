import type { GameMode, LevelConfig } from './types';
import { generateLevelConfig } from './levelGenerator';

export const MAX_LEVELS = 100;

const levelPool: Record<GameMode, LevelConfig[]> = {
  classic: [],
  math_tour: [],
};

function buildLevelPool(mode: GameMode): LevelConfig[] {
  const levels: LevelConfig[] = [];
  for (let level = 1; level <= MAX_LEVELS; level++) {
    levels.push(generateLevelConfig(level, mode));
  }
  return levels;
}

export function getFixedLevelConfig(level: number, mode: GameMode): LevelConfig {
  if (levelPool[mode].length === 0) {
    levelPool[mode] = buildLevelPool(mode);
  }
  const normalizedLevel = Math.min(Math.max(level, 1), MAX_LEVELS);
  return levelPool[mode][normalizedLevel - 1];
}

