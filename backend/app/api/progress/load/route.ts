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
    const progress = await prisma.gameProgress.findUnique({
      where: { portal_user_id: payload.user_id },
    });

    const origin = request.headers.get('Origin');
    if (!progress) {
      return jsonResponse({
        success: true,
        message: 'No progress found',
        data: { high_score: 0, total_levels: 0 },
      }, undefined, origin);
    }

    return jsonResponse({
      success: true,
      message: 'Progress loaded successfully',
      data: {
        high_score: progress.high_score,
        total_levels: progress.total_levels,
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
