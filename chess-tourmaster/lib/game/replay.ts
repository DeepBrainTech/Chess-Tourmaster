import { getFixedLevelConfig } from './levelCatalog';
import { gameReducer, initialGameState, isValidMove } from './gameReducer';
import type { GameMode, Position } from './types';
import { samePosition } from './moves';

export function replayGame(level: number, mode: GameMode, moves: unknown, requireWin: boolean) {
  if (!Array.isArray(moves) || moves.length > 49) throw new Error('INVALID_MOVES');
  let state = gameReducer({ ...initialGameState, gameMode: mode }, {
    type: 'START_LEVEL', payload: getFixedLevelConfig(level, mode),
  });
  for (const move of moves as Position[]) {
    if (!move || !isValidMove(state, move.r, move.c)) throw new Error('INVALID_MOVES');
    state = gameReducer(state, { type: 'MOVE', payload: move });
  }
  const won = !state.isPlaying && samePosition(state.knightPos, state.kingPos);
  if (requireWin && !won) throw new Error('INCOMPLETE_GAME');
  if (!requireWin && won) throw new Error('GAME_FINISHED');
  return state;
}
