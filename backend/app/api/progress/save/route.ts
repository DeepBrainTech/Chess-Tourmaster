import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { addHintCount, ensureUserHint } from '@/lib/userHint';

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

    let hintCount = (await ensureUserHint(payload.user_id, payload.username)).hint_count;

    if (level_data && typeof level_data === 'object') {
      const mode = level_data.game_mode === 'math_tour' ? 'math_tour' : 'classic';
      const level = typeof level_data.level === 'number' ? Math.max(1, Math.floor(level_data.level)) : 1;
      const unlockedFromLevel = Math.min(100, level + 1);
      modeUnlockedLevel = Math.max(modeUnlockedLevel, unlockedFromLevel);

      await prisma.levelRecord.create({
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

      const existingModeProgress = await prisma.modeProgress.findUnique({
        where: {
          portal_user_id_game_mode: {
            portal_user_id: payload.user_id,
            game_mode: mode,
          },
        },
        select: { max_unlocked_level: true },
      });

      await prisma.modeProgress.upsert({
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

      const updatedHint = await addHintCount(payload.user_id, payload.username, 1);
      hintCount = updatedHint.hint_count;
    }

    return jsonResponse(
      {
        success: true,
        message: 'Progress saved successfully',
        data: {
          high_score: 0,
          total_levels: modeUnlockedLevel,
          best_moves: null,
          total_moves: 0,
          hint_count: hintCount,
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
