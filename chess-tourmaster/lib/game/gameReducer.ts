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
  | { type: 'SET_MAX_UNLOCKED_LEVEL'; payload: number }
  | { type: 'SET_LEVEL_STARS'; payload: Record<number, number> }
  | { type: 'UPSERT_LEVEL_STAR'; payload: { level: number; stars: number } }
  | { type: 'WIN_LEVEL' }
  | { type: 'LOSE_LEVEL' };

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
        if (!canMoveToKing(state)) return state;
        const entry: HistoryEntry = {
          knightPos: { ...curr },
          prevPos: { r, c },
          scoreCollected: 0,
          valueRestored: 0,
          multiplierUsed: state.scoreMultiplier,
        };
        return {
          ...state,
          knightPos: { r, c },
          history: [...state.history, entry],
          isPlaying: false,
        };
      }

      const collectedValue = targetTile.value ?? 0;
      const tileMult = targetTile.tileMultiplier ?? 1;
      const multiplierUsed = state.scoreMultiplier;
      let finalScore = 0;
      if (isMathTour) {
        if (tileMult > 1) {
          finalScore = state.currentScore * (tileMult - 1);
        } else {
          finalScore = collectedValue * multiplierUsed;
        }
      }
      const multiplierAfterMove = 1;

      const newGrid = deepCopyGrid(state.grid);
      // Extinguish fire on the tile we are leaving.
      if (newGrid[curr.r]?.[curr.c]?.hasFire) {
        newGrid[curr.r][curr.c] = { ...newGrid[curr.r][curr.c], hasFire: false };
      }
      // Keep fire on the tile we just landed on so 3s timer can run.
      const newTile = { ...newGrid[r][c], visited: true };
      if (isMathTour) newTile.value = 0;
      newGrid[r][c] = newTile;

      const entry: HistoryEntry = {
        knightPos: { ...curr },
        prevPos: { r, c },
        scoreCollected: finalScore,
        valueRestored: collectedValue,
        multiplierUsed,
        tileMultiplier: targetTile.tileMultiplier ?? 1,
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

    case 'WIN_LEVEL':
      return {
        ...state,
        isPlaying: false,
      };

    case 'LOSE_LEVEL':
      return {
        ...state,
        isPlaying: false,
      };

    case 'SET_SAVED_CONFIG':
      return { ...state, savedGridConfig: action.payload };

    default:
      return state;
  }
}

export function canMoveToKing(state: GameState): boolean {
  if (state.gameMode === 'math_tour') {
    return state.currentScore >= state.requiredScore;
  }
  return state.tilesLeft === 0;
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

export function isKingAccessExhausted(state: GameState): boolean {
  const canCaptureKingNow = getValidMoves(state.knightPos.r, state.knightPos.c, state.gridSizeVal).some(
    (m) => m.r === state.kingPos.r && m.c === state.kingPos.c
  ) && canMoveToKing(state);
  if (canCaptureKingNow) return false;

  const kingApproachTiles = getValidMoves(state.kingPos.r, state.kingPos.c, state.gridSizeVal);
  const hasAvailableApproach = kingApproachTiles.some((m) => {
    const tile = state.grid[m.r]?.[m.c];
    if (!tile) return false;
    if (tile.type === 'void' || tile.type === 'king') return false;
    return !tile.visited;
  });
  return !hasAvailableApproach;
}
