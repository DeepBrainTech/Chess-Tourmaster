export type GameMode = 'classic' | 'math_tour';

/** Math Tour 格子上的棋子，用于显示与分数对应 */
export type MathPiece = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen';

export const MATH_PIECE_CONFIG: Record<
  MathPiece,
  { value: number; tileMultiplier: number }
> = {
  pawn: { value: 1, tileMultiplier: 1 },
  knight: { value: 3, tileMultiplier: 1 },
  bishop: { value: -3, tileMultiplier: 1 },
  rook: { value: 5, tileMultiplier: 1 },
  queen: { value: 0, tileMultiplier: 2 },
};

export interface TileData {
  type: 'empty' | 'void' | 'king';
  hasFire: boolean;
  visited: boolean;
  r: number;
  c: number;
  value: number;
  /** Math Tour: 1, 2, or 3 — score for this tile is value * tileMultiplier * fireMultiplier */
  tileMultiplier?: number;
  /** Math Tour: 格子显示的棋子，分数由 MATH_PIECE_CONFIG 决定 */
  piece?: MathPiece;
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
  /** Math Tour: 格子乘数 2/3 表示 x2/x3，1 表示加减格 */
  tileMultiplier?: number;
}

export interface GameState {
  level: number;
  maxUnlockedLevel: number;
  levelStars: Record<number, number>;
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
  gameStartTime: number;
  gameTimeSeconds: number;
  theme: string;
}

export type ModalType = 'none' | 'mode' | 'welcome' | 'win' | 'lose' | 'settings' | 'help' | 'leaderboard';
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
