import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ensureUserHint } from '@/lib/userHint';
import { LEVEL_VERSION, MAX_LEVELS, calculateStars } from './rules';
import { replayGame } from './replay';
import { getHintMove } from './hint';
import { createHash } from 'node:crypto';
import type { GameMode } from './types';

type Identity = { user_id: number; username: string };
export class GameRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// All progress, attempt transitions and first-clear rewards for an account share this row lock.
async function withAccount<T>(user: Identity, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  await ensureUserHint(user.user_id, user.username);
  return prisma.$transaction(async tx => {
    await tx.userHint.update({ where: { portal_user_id: user.user_id }, data: { username: user.username } });
    return fn(tx);
  }, { maxWait: 10000, timeout: 15000 });
}

async function unlockedLevel(tx: Prisma.TransactionClient, userId: number, mode: GameMode) {
  const progress = await tx.modeProgress.findUnique({ where: {
    portal_user_id_game_mode: { portal_user_id: userId, game_mode: mode },
  } });
  if (progress) return Math.max(1, Math.min(MAX_LEVELS, progress.max_unlocked_level));
  const legacy = await tx.levelRecord.aggregate({
    where: { portal_user_id: userId, game_mode: mode, level: { gte: 1, lte: MAX_LEVELS } }, _max: { level: true },
  });
  return Math.min(MAX_LEVELS, (legacy._max.level ?? 0) + 1);
}

export async function startAttempt(user: Identity, level: unknown, mode: unknown) {
  if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > MAX_LEVELS
    || (mode !== 'classic' && mode !== 'math_tour')) throw new GameRequestError('INVALID_LEVEL');
  return withAccount(user, async tx => {
    if ((level as number) > await unlockedLevel(tx, user.user_id, mode)) throw new GameRequestError('LEVEL_LOCKED', 403);
    const attempt = await tx.gameAttempt.create({ data: {
      portal_user_id: user.user_id, level: level as number, game_mode: mode,
      level_version: LEVEL_VERSION, resumed_at: new Date(),
    } });
    return { attempt_id: attempt.id, level_version: attempt.level_version };
  });
}

async function ownedAttempt(tx: Prisma.TransactionClient, user: Identity, id: unknown) {
  if (typeof id !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new GameRequestError('INVALID_ATTEMPT');
  const attempt = await tx.gameAttempt.findFirst({ where: { id, portal_user_id: user.user_id } });
  if (!attempt || attempt.level_version !== LEVEL_VERSION) throw new GameRequestError('INVALID_ATTEMPT', 409);
  if (Date.now() - attempt.started_at.getTime() > 24 * 60 * 60 * 1000) throw new GameRequestError('ATTEMPT_EXPIRED', 409);
  return attempt;
}

export async function transitionAttempt(user: Identity, id: unknown, action: unknown) {
  if (action !== 'pause' && action !== 'resume') throw new GameRequestError('INVALID_ACTION');
  return withAccount(user, async tx => {
    const attempt = await ownedAttempt(tx, user, id);
    if (attempt.finished_at) {
      if (action === 'pause') return { success: true };
      throw new GameRequestError('GAME_FINISHED', 409);
    }
    const now = new Date();
    if (action === 'pause' && attempt.resumed_at) {
      await tx.gameAttempt.update({ where: { id: attempt.id }, data: {
        active_ms: attempt.active_ms + Math.max(0, now.getTime() - attempt.resumed_at.getTime()), resumed_at: null,
      } });
    } else if (action === 'resume' && !attempt.resumed_at) {
      await tx.gameAttempt.update({ where: { id: attempt.id }, data: { resumed_at: now } });
    }
    return { success: true };
  });
}

export async function finishAttempt(user: Identity, id: unknown, moves: unknown) {
  return withAccount(user, async tx => {
    const attempt = await ownedAttempt(tx, user, id);
    const mode = attempt.game_mode as GameMode;
    // Validate even retries. Never accept client-supplied score, stars, level or time.
    let state;
    try { state = replayGame(attempt.level, mode, moves, true); }
    catch { throw new GameRequestError('INVALID_SOLUTION'); }
    const unlocked = await unlockedLevel(tx, user.user_id, mode);
    if (attempt.level > unlocked) throw new GameRequestError('LEVEL_LOCKED', 403);
    let stars = attempt.stars ?? 1;
    let activeMs = attempt.active_ms;
    if (!attempt.finished_at) {
      const now = new Date();
      activeMs += attempt.resumed_at ? Math.max(0, now.getTime() - attempt.resumed_at.getTime()) : 0;
      stars = calculateStars(mode, state.currentScore, state.requiredScore, activeMs / 1000, state.parTime);
      const completed = await tx.levelRecord.findFirst({ where: { portal_user_id: user.user_id, game_mode: mode, level: attempt.level } });
      await tx.levelRecord.create({ data: {
        portal_user_id: user.user_id, username: user.username, game_mode: mode, level: attempt.level,
        moves_count: state.history.length, time_seconds: Math.floor(activeMs / 1000), stars,
      } });
      const next = Math.max(unlocked, Math.min(MAX_LEVELS, attempt.level + 1));
      await tx.modeProgress.upsert({ where: { portal_user_id_game_mode: { portal_user_id: user.user_id, game_mode: mode } },
        create: { portal_user_id: user.user_id, username: user.username, game_mode: mode, max_unlocked_level: next },
        update: { username: user.username, max_unlocked_level: next } });
      if (!completed) await tx.userHint.update({ where: { portal_user_id: user.user_id }, data: {
        hint_count: { increment: 1 }, undo_count: { increment: 1 },
      } });
      await tx.gameAttempt.update({ where: { id: attempt.id }, data: {
        finished_at: now, resumed_at: null, active_ms: activeMs, stars, moves_count: state.history.length,
      } });
    }
    const inventory = await tx.userHint.findUniqueOrThrow({ where: { portal_user_id: user.user_id },
      select: { hint_count: true, undo_count: true } });
    return { ...inventory, total_levels: Math.max(unlocked, Math.min(MAX_LEVELS, attempt.level + 1)), stars,
      time_seconds: Math.floor(activeMs / 1000) };
  });
}

export async function useAttemptHint(user: Identity, id: unknown, moves: unknown) {
  return withAccount(user, async tx => {
    const attempt = await ownedAttempt(tx, user, id);
    if (attempt.finished_at) throw new GameRequestError('GAME_FINISHED', 409);
    let state;
    try { state = replayGame(attempt.level, attempt.game_mode as GameMode, moves, false); }
    catch { throw new GameRequestError('INVALID_MOVES'); }
    const key = createHash('sha256').update(JSON.stringify({
      position: state.knightPos, score: state.currentScore, visited: state.grid.flat().map(tile => tile.visited),
    })).digest('hex');
    const previous = await tx.attemptHint.findUnique({ where: {
      attempt_id_position_key: { attempt_id: attempt.id, position_key: key },
    } });
    const balance = await tx.userHint.findUniqueOrThrow({ where: { portal_user_id: user.user_id } });
    if (previous) return { hint_count: balance.hint_count, move: { r: previous.move_r, c: previous.move_c } };
    const hint = getHintMove(state);
    if (hint.type !== 'next_move') throw new GameRequestError(hint.type === 'no_win_path' ? 'NO_WIN_PATH' : 'SEARCH_EXHAUSTED', 422);
    if (balance.hint_count <= 0) throw new GameRequestError('NO_HINT_LEFT', 409);
    const inventory = await tx.userHint.update({ where: { portal_user_id: user.user_id }, data: { hint_count: { decrement: 1 } } });
    await tx.attemptHint.create({ data: { attempt_id: attempt.id, position_key: key, move_r: hint.move.r, move_c: hint.move.c } });
    return { hint_count: inventory.hint_count, move: hint.move };
  });
}
