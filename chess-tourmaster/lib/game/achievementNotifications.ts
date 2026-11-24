import type { AchievementNotification, Prisma } from '@prisma/client';
import jwt, { type Algorithm } from 'jsonwebtoken';
import { getPortalApiBase } from '@/lib/apiBase';
import { prisma } from '@/lib/prisma';
import { MAX_LEVELS } from './rules';
import type { GameMode } from './types';

const GAME_KEY = 'chess-tourmaster';
const RETRY_INTERVAL_MS = 60_000;
const DELIVERY_TIMEOUT_MS = 4_000;
const BATCH_SIZE = 20;

export async function queueAchievementProgress(
  tx: Prisma.TransactionClient,
  attemptId: string,
  userId: number,
  mode: GameMode,
  newClear: boolean,
  newThreeStars: boolean,
) {
  const levels = await tx.levelBest.findMany({
    where: { portal_user_id: userId, game_mode: mode, level: { gte: 1, lte: MAX_LEVELS } },
    select: { best_stars: true },
  });
  await tx.achievementNotification.create({
    data: {
      attempt_id: attemptId,
      portal_user_id: userId,
      game_mode: mode,
      clears: levels.length,
      three_stars: levels.filter(level => level.best_stars === 3).length,
      new_clear: newClear,
      new_three_stars: newThreeStars,
    },
  });
}

async function sendAchievementProgress(event: AchievementNotification, secret: string, base: string) {
  const token = jwt.sign({
    purpose: 'achievement-progress',
    user_id: String(event.portal_user_id),
    mode: event.game_mode,
    clears: event.clears,
    three_stars: event.three_stars,
    new_clear: event.new_clear,
    new_three_stars: event.new_three_stars,
  }, secret, {
    algorithm: (process.env.TOURMASTER_JWT_ALG || 'HS256') as Algorithm,
    audience: `${GAME_KEY}-achievements`,
    issuer: `${GAME_KEY}-game`,
    expiresIn: 60,
  });
  const response = await fetch(`${base}/api/games/${GAME_KEY}/achievements/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Portal returned HTTP ${response.status}`);
  const result = await response.json();
  if (result?.success !== true || result.data?.game_key !== GAME_KEY || !Array.isArray(result.data.accepted)) {
    throw new Error('Portal did not acknowledge achievement progress');
  }
}

export async function deliverAchievementNotifications(userId?: number) {
  const secret = process.env.TOURMASTER_REWARD_SECRET?.trim() || process.env.TOURMASTER_JWT_SECRET?.trim();
  if (!secret) return;
  const base = (process.env.PORTAL_INTERNAL_API_URL?.trim() || getPortalApiBase()).replace(/\/+$/, '');

  try {
    const events = await prisma.achievementNotification.findMany({
      where: { portal_user_id: userId, next_attempt_at: { lte: new Date() } },
      orderBy: { next_attempt_at: 'asc' },
      take: BATCH_SIZE,
    });
    await Promise.all(events.map(async event => {
      const where = { attempt_id: event.attempt_id };
      try {
        await sendAchievementProgress(event, secret, base);
        await prisma.achievementNotification.deleteMany({ where });
      } catch (error) {
        await prisma.achievementNotification.updateMany({
          where, data: { next_attempt_at: new Date(Date.now() + RETRY_INTERVAL_MS) },
        });
        console.warn('Achievement notification delivery pending:', error instanceof Error ? error.message : 'Unknown error');
      }
    }));
  } catch (error) {
    console.warn('Could not process achievement notifications:', error instanceof Error ? error.message : 'Unknown error');
  }
}

let retryTimer: NodeJS.Timeout | undefined;

export function startAchievementNotificationRetry() {
  retryTimer ??= setInterval(() => { void deliverAchievementNotifications(); }, RETRY_INTERVAL_MS).unref();
}
