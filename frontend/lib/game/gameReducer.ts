import type { GameState, LevelConfig, HistoryEntry, GameMode, ThemeName } from './types';
import { THEME_CLASSES } from './types';
import { getValidMoves } from './levelGenerator';

export type GameAction =
  | { type: 'SET_MODE'; payload: GameMode }
  | { type: 'START_LEVEL'; payload: LevelConfig }
  | { type: 'SET_SAVED_CONFIG'; payload: LevelConfig | null }
  | { type: 'MOVE'; payload: { r: number; c: number } }
  | { type: 'SET_GAME_TIME'; payload: number }
  | { type: 'SET_THEME'; payload: ThemeName }
  | { type: 'LOAD_HIGH_SCORE'; payload: number }
  | { type: 'SET_MAX_UNLOCKED_LEVEL'; payload: number }
  | { type: 'SET_LEVEL_STARS'; payload: Record<number, number> }
  | { type: 'UPSERT_LEVEL_STAR'; payload: { level: number; stars: number } }
  | { type: 'WIN_LEVEL'; payload: { levelBonus: number; streakBonus: number } }
  | { type: 'LOSE_LEVEL' }
  | { type: 'RESET_RUN' }
  | { type: 'PREPARE_RETRY' };

const deepCopyGrid = (grid: GameState['grid']) =>
  grid.map(row => row.map(tile => ({ ...tile })));

export const initialGameState: GameState = {
  level: 1,
  maxUnlockedLevel: 1,
  levelStars: {},
  grid: [],
  knightPos: { r: 0, c: 0 },
  kingPos: { r: 0, c: 0 },
  history: [],
  tilesLeft: 0,
  parTime: 10,
  isPlaying: false,
  gridSizeVal: 5,
  gameMode: 'classic',
  currentScore: 0,
  requiredScore: 0,
  scoreMultiplier: 1,
  savedGridConfig: null,
  currentRunScore: 0,
  cumulativeBaseScore: 0,
  highScore: 0,
  streak: 0,
  gameStartTime: 0,
  gameTimeSeconds: 0,
  theme: THEME_CLASSES.cosmic,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        gameMode: action.payload,
        level: 1,
        maxUnlockedLevel: 1,
        levelStars: {},
        currentRunScore: 0,
        cumulativeBaseScore: 0,
        streak: 0,
        savedGridConfig: null,
        scoreMultiplier: 1,
      };

    case 'START_LEVEL': {
      const config = action.payload;
      const grid = deepCopyGrid(config.grid);
      return {
        ...state,
        level: config.level,
        grid,
        knightPos: { ...config.knightPos },
        kingPos: { ...config.kingPos },
        gridSizeVal: config.gridSizeVal,
        tilesLeft: config.tilesLeft,
        parTime: config.parTime,
        currentScore: config.initialScore,
        requiredScore: config.requiredScore,
        scoreMultiplier: 1,
        history: [],
        isPlaying: true,
        gameStartTime: Date.now(),
        gameTimeSeconds: 0,
      };
    }

    case 'MOVE': {
      const { r, c } = action.payload;
      const curr = state.knightPos;
      const dr = Math.abs(curr.r - r);
      const dc = Math.abs(curr.c - c);
      if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) return state;

      const targetTile = state.grid[r][c];
      const isMathTour = state.gameMode === 'math_tour';
      if (targetTile.type === 'void' || targetTile.visited) return state;
      if (targetTile.type === 'king') {
        const hasCleared = state.tilesLeft === 0;
        if (!hasCleared) return state;
        return state;
      }

      const collectedValue = targetTile.value;
      const multiplierUsed = state.scoreMultiplier;
      const finalScore = 0;
      const multiplierAfterMove = 1;

      const newGrid = deepCopyGrid(state.grid);
      const newTile = { ...newGrid[r][c], visited: true };
      if (isMathTour) newTile.value = 0;
      newGrid[r][c] = newTile;

      const entry: HistoryEntry = {
        knightPos: { ...curr },
        prevPos: { r, c },
        scoreCollected: finalScore,
        valueRestored: collectedValue,
        multiplierUsed,
      };

      return {
        ...state,
        grid: newGrid,
        knightPos: { r, c },
        history: [...state.history, entry],
        tilesLeft: state.tilesLeft - 1,
        currentScore: state.currentScore + finalScore,
        scoreMultiplier: multiplierAfterMove,
      };
    }

    case 'SET_GAME_TIME':
      return { ...state, gameTimeSeconds: action.payload };

    case 'SET_THEME':
      return { ...state, theme: THEME_CLASSES[action.payload] };

    case 'LOAD_HIGH_SCORE':
      return { ...state, highScore: action.payload };

    case 'SET_MAX_UNLOCKED_LEVEL':
      return { ...state, maxUnlockedLevel: action.payload };

    case 'SET_LEVEL_STARS':
      return { ...state, levelStars: action.payload };

    case 'UPSERT_LEVEL_STAR': {
      const prev = state.levelStars[action.payload.level] ?? 0;
      if (action.payload.stars <= prev) return state;
      return {
        ...state,
        levelStars: {
          ...state.levelStars,
          [action.payload.level]: action.payload.stars,
        },
      };
    }

    case 'WIN_LEVEL': {
      const { levelBonus, streakBonus } = action.payload;
      const newCumulative = state.cumulativeBaseScore + levelBonus;
      const newStreak = state.streak + 1;
      const newRunScore = state.currentRunScore + levelBonus + streakBonus;
      const isNewHigh = newCumulative > state.highScore;
      return {
        ...state,
        isPlaying: false,
        currentRunScore: newRunScore,
        cumulativeBaseScore: newCumulative,
        streak: newStreak,
        highScore: isNewHigh ? newCumulative : state.highScore,
      };
    }

    case 'LOSE_LEVEL':
      return {
        ...state,
        isPlaying: false,
        currentRunScore: state.cumulativeBaseScore,
        streak: 0,
      };

    case 'RESET_RUN':
      return {
        ...state,
        currentRunScore: 0,
        cumulativeBaseScore: 0,
        streak: 0,
        savedGridConfig: null,
      };

    case 'SET_SAVED_CONFIG':
      return { ...state, savedGridConfig: action.payload };

    case 'PREPARE_RETRY':
      return {
        ...state,
        currentRunScore: state.cumulativeBaseScore,
        streak: 0,
      };

    default:
      return state;
  }
}

export function canMoveToKing(state: GameState): boolean {
  const tilesCleared = state.tilesLeft === 0;
  return tilesCleared;
}

export function isValidMove(state: GameState, r: number, c: number): boolean {
  const curr = state.knightPos;
  const dr = Math.abs(curr.r - r);
  const dc = Math.abs(curr.c - c);
  if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) return false;

  const tile = state.grid[r]?.[c];
  if (!tile || tile.type === 'void' || tile.visited) return false;

  if (tile.type === 'king') return canMoveToKing(state);

  return true;
}

export function isStuck(state: GameState): boolean {
  const moves = getValidMoves(state.knightPos.r, state.knightPos.c, state.gridSizeVal);
  const canReach = moves.some(m => {
    const t = state.grid[m.r]?.[m.c];
    if (!t || t.type === 'void' || t.visited) return false;
    if (t.type === 'king') return canMoveToKing(state);
    return true;
  });
  return !canReach;
}
