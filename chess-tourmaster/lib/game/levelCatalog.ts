import type { GameMode, LevelConfig } from './types';
import { generateLevelConfig } from './levelGenerator';
export { MAX_LEVELS } from './rules';

const levels = new Map<string, LevelConfig>();

export function getFixedLevelConfig(level: number, mode: GameMode): LevelConfig {
  const key = `${mode}:${level}`;
  let config = levels.get(key);
  if (!config) {
    config = generateLevelConfig(level, mode);
    levels.set(key, config);
  }
  return { ...config, grid: config.grid.map(row => row.map(tile => ({ ...tile }))),
    knightPos: { ...config.knightPos }, kingPos: { ...config.kingPos },
    solution: config.solution?.map(p => ({ ...p })) };
}
