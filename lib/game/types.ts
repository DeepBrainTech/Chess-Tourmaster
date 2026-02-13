export type GameMode = 'classic' | 'math_tour';

export interface TileData {
  type: 'empty' | 'void' | 'king';
  hasFire: boolean;
  visited: boolean;
  r: number;
  c: number;
  value: number;
}

export interface LevelConfig {
  level: number;
  grid: TileData[][];
  knightPos: { r: number; c: number };
  kingPos: { r: number; c: number };
  gridSizeVal: number;
  tilesLeft: number;
  parTime: number;
  initialScore: number;
  requiredScore: number;
}

export interface HistoryEntry {
  knightPos: { r: number; c: number };
  prevPos: { r: number; c: number };
  scoreCollected: number;
  valueRestored: number;
  multiplierUsed: number;
}

export interface GameState {
  level: number;
  grid: TileData[][];
  knightPos: { r: number; c: number };
  kingPos: { r: number; c: number };
  history: HistoryEntry[];
  tilesLeft: number;
  parTime: number;
  isPlaying: boolean;
  gridSizeVal: number;
  gameMode: GameMode;
  currentScore: number;
  requiredScore: number;
  scoreMultiplier: number;
  savedGridConfig: LevelConfig | null;
  currentRunScore: number;
  cumulativeBaseScore: number;
  highScore: number;
  streak: number;
  gameStartTime: number;
  gameTimeSeconds: number;
  theme: string;
}

export type ModalType = 'none' | 'mode' | 'welcome' | 'win' | 'lose' | 'settings' | 'help';
export type ThemeName = 'cosmic' | 'royal' | 'nature' | 'inferno' | 'desert' | 'frost' | 'volcanic';

export const THEME_CLASSES: Record<ThemeName, string> = {
  cosmic: 'bg-theme-cosmic',
  royal: 'bg-theme-royal',
  nature: 'bg-theme-nature',
  inferno: 'bg-theme-inferno',
  desert: 'bg-theme-desert',
  frost: 'bg-theme-frost',
  volcanic: 'bg-theme-volcanic',
};
