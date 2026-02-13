import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * 加载游戏进度
 * GET /api/progress/load
 */
export const GET = requireAuth(async (request: NextRequest, payload) => {
  try {
    const { searchParams } = new URL(request.url);
    const gameMode = searchParams.get('game_mode');
    const progress = await prisma.gameProgress.findUnique({
      where: { portal_user_id: payload.user_id },
    });

    const origin = request.headers.get('Origin');
    const hasModeFilter = gameMode === 'classic' || gameMode === 'math_tour';
    let modeUnlockedLevel = 1;

    if (hasModeFilter) {
      const modeProgress = await prisma.modeProgress.findUnique({
        where: {
          portal_user_id_game_mode: {
            portal_user_id: payload.user_id,
            game_mode: gameMode,
          },
        },
        select: { max_unlocked_level: true },
      });

      if (modeProgress?.max_unlocked_level != null) {
        modeUnlockedLevel = Math.max(1, Math.min(100, Math.floor(modeProgress.max_unlocked_level)));
      } else {
        // Backward-compatible fallback for old data before mode_progress table.
        const modeMax = await prisma.levelRecord.aggregate({
          where: {
            portal_user_id: payload.user_id,
            game_mode: gameMode,
          },
          _max: { level: true },
        });
        const maxCompleted = modeMax._max.level ?? 0;
        modeUnlockedLevel = Math.max(1, Math.min(100, maxCompleted + 1));
      }
    }

    if (!progress) {
      return jsonResponse({
        success: true,
        message: 'No progress found',
        data: { high_score: 0, total_levels: hasModeFilter ? modeUnlockedLevel : 0 },
      }, undefined, origin);
    }

    return jsonResponse({
      success: true,
      message: 'Progress loaded successfully',
      data: {
        high_score: progress.high_score,
        total_levels: hasModeFilter ? modeUnlockedLevel : progress.total_levels,
        best_moves: progress.best_moves,
        total_moves: progress.total_moves,
      },
    }, undefined, origin);
  } catch (error) {
    console.error('Load progress error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to load progress', code: 'SERVER_ERROR' },
      { status: 500 },
      request.headers.get('Origin')
    );
  }
});

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
