import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { ensureUserHint } from '@/lib/userHint';

/**
 * Load mode progress.
 * GET /api/progress/load?game_mode=classic|math_tour
 */
export const GET = requireAuth(async (request: NextRequest, payload) => {
  try {
    const { searchParams } = new URL(request.url);
    const gameMode = searchParams.get('game_mode');
    const origin = request.headers.get('Origin');

    const hasModeFilter = gameMode === 'classic' || gameMode === 'math_tour';
    const userHint = await ensureUserHint(payload.user_id, payload.username);

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

      let modeUnlockedLevel = 1;
      if (modeProgress?.max_unlocked_level != null) {
        modeUnlockedLevel = Math.max(1, Math.min(100, Math.floor(modeProgress.max_unlocked_level)));
      } else {
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

      return jsonResponse(
        {
          success: true,
          message: 'Progress loaded successfully',
          data: {
            total_levels: modeUnlockedLevel,
            best_moves: null,
            total_moves: 0,
            hint_count: userHint.hint_count,
            undo_count: userHint.undo_count,
          },
        },
        undefined,
        origin
      );
    }

    const maxUnlocked = await prisma.modeProgress.aggregate({
      where: { portal_user_id: payload.user_id },
      _max: { max_unlocked_level: true },
    });

    return jsonResponse(
      {
        success: true,
        message: 'Progress loaded successfully',
        data: {
          total_levels: Math.max(1, maxUnlocked._max.max_unlocked_level ?? 1),
          best_moves: null,
          total_moves: 0,
          hint_count: userHint.hint_count,
          undo_count: userHint.undo_count,
        },
      },
      undefined,
      origin
    );
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
