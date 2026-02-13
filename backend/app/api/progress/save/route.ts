import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * Save game progress.
 * POST /api/progress/save
 * Body: {
 *   high_score?: number,
 *   total_levels?: number,
 *   best_moves?: number,
 *   total_moves?: number,
 *   level_data?: { level, moves_count, time_seconds, stars, game_mode }
 * }
 */
export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const body = await request.json();
    const { high_score, total_levels, best_moves, total_moves, level_data } = body;

    const normalizedHighScore =
      typeof high_score === 'number' && Number.isFinite(high_score) && high_score >= 0
        ? Math.floor(high_score)
        : 0;

    // Keep this row for user-level relation and backward compatibility.
    const updateData: any = {
      high_score: normalizedHighScore,
      updated_at: new Date(),
    };

    if (total_levels !== undefined) updateData.total_levels = total_levels;
    if (best_moves !== undefined) updateData.best_moves = best_moves;
    if (total_moves !== undefined) updateData.total_moves = total_moves;

    const progress = await prisma.gameProgress.upsert({
      where: { portal_user_id: payload.user_id },
      update: updateData,
      create: {
        portal_user_id: payload.user_id,
        username: payload.username,
        high_score: normalizedHighScore,
        total_levels: total_levels ?? 0,
        best_moves: best_moves,
        total_moves: total_moves ?? 0,
      },
    });

    let modeUnlockedLevel = 1;

    if (level_data && typeof level_data === 'object') {
      const mode = level_data.game_mode === 'math_tour' ? 'math_tour' : 'classic';
      const level = typeof level_data.level === 'number' ? Math.max(1, Math.floor(level_data.level)) : 1;
      const unlockedFromLevel = Math.min(100, level + 1);
      const unlockedFromPayload =
        typeof total_levels === 'number' ? Math.max(1, Math.min(100, Math.floor(total_levels))) : 1;
      modeUnlockedLevel = Math.max(unlockedFromLevel, unlockedFromPayload);

      await prisma.levelRecord.create({
        data: {
          portal_user_id: payload.user_id,
          username: payload.username,
          level,
          moves_count: level_data.moves_count || 0,
          time_seconds: level_data.time_seconds || 0,
          // Score system is deprecated; keep DB compatibility with constant 0.
          score: 0,
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
          max_unlocked_level: Math.max(existingModeProgress?.max_unlocked_level ?? 1, modeUnlockedLevel),
          updated_at: new Date(),
        },
        create: {
          portal_user_id: payload.user_id,
          game_mode: mode,
          max_unlocked_level: modeUnlockedLevel,
        },
      });
    }

    return jsonResponse(
      {
        success: true,
        message: 'Progress saved successfully',
        data: {
          high_score: progress.high_score,
          total_levels: modeUnlockedLevel,
          best_moves: progress.best_moves,
          total_moves: progress.total_moves,
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
