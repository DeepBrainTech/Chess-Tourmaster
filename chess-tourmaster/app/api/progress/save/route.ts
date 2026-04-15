import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { ensureUserHint } from '@/lib/userHint';

/**
 * Save mode progress and per-level record.
 * POST /api/progress/save
 * Body: {
 *   total_levels?: number,
 *   level_data?: { level, moves_count, time_seconds, stars, game_mode }
 * }
 */
export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const body = await request.json();
    const { total_levels, level_data } = body;

    let modeUnlockedLevel =
      typeof total_levels === 'number' ? Math.max(1, Math.min(100, Math.floor(total_levels))) : 1;

    const userInventory = await ensureUserHint(payload.user_id, payload.username);
    let hintCount = userInventory.hint_count;
    let undoCount = userInventory.undo_count;

    if (level_data && typeof level_data === 'object') {
      const mode = level_data.game_mode === 'math_tour' ? 'math_tour' : 'classic';
      const level = typeof level_data.level === 'number' ? Math.max(1, Math.floor(level_data.level)) : 1;
      const unlockedFromLevel = Math.min(100, level + 1);
      modeUnlockedLevel = Math.max(modeUnlockedLevel, unlockedFromLevel);
      await prisma.$transaction(async (tx) => {
        const existingModeProgress = await tx.modeProgress.findUnique({
          where: {
            portal_user_id_game_mode: {
              portal_user_id: payload.user_id,
              game_mode: mode,
            },
          },
          select: { max_unlocked_level: true },
        });
        const alreadyCompletedLevel = await tx.levelRecord.findFirst({
          where: {
            portal_user_id: payload.user_id,
            game_mode: mode,
            level,
          },
          select: { id: true },
        });

        await tx.levelRecord.create({
          data: {
            portal_user_id: payload.user_id,
            username: payload.username,
            level,
            moves_count: level_data.moves_count || 0,
            time_seconds: level_data.time_seconds || 0,
            stars: level_data.stars || 1,
            game_mode: mode,
          },
        });

        await tx.modeProgress.upsert({
          where: {
            portal_user_id_game_mode: {
              portal_user_id: payload.user_id,
              game_mode: mode,
            },
          },
          update: {
            username: payload.username,
            max_unlocked_level: Math.max(existingModeProgress?.max_unlocked_level ?? 1, modeUnlockedLevel),
            updated_at: new Date(),
          },
          create: {
            portal_user_id: payload.user_id,
            username: payload.username,
            game_mode: mode,
            max_unlocked_level: modeUnlockedLevel,
          },
        });

        if (!alreadyCompletedLevel) {
          const updatedInventory = await tx.userHint.update({
            where: { portal_user_id: payload.user_id },
            data: {
              username: payload.username,
              hint_count: { increment: 1 },
              undo_count: { increment: 1 },
            },
            select: { hint_count: true, undo_count: true },
          });
          hintCount = updatedInventory.hint_count;
          undoCount = updatedInventory.undo_count;
        }
      });

      if (hintCount === userInventory.hint_count && undoCount === userInventory.undo_count) {
        const latestInventory = await ensureUserHint(payload.user_id, payload.username);
        hintCount = latestInventory.hint_count;
        undoCount = latestInventory.undo_count;
      }
    }

    return jsonResponse(
      {
        success: true,
        message: 'Progress saved successfully',
        data: {
          total_levels: modeUnlockedLevel,
          best_moves: null,
          total_moves: 0,
          hint_count: hintCount,
          undo_count: undoCount,
        },
      },
      undefined,
      origin
    );
  } catch (error) {
    console.error('Save progress error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to save progress', code: 'SERVER_ERROR' },
      { status: 500 },
      origin
    );
  }
});

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
