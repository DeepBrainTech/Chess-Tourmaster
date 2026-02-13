import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * 获取排行榜
 * GET /api/leaderboard?limit=10
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const leaderboard = await prisma.gameProgress.findMany({
      orderBy: { high_score: 'desc' },
      take: Math.min(limit, 100),
      select: {
        portal_user_id: true,
        username: true,
        high_score: true,
        total_levels: true,
        updated_at: true,
      },
    });

    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return jsonResponse({
      success: true,
      message: 'Leaderboard loaded successfully',
      data: rankedLeaderboard,
    }, undefined, origin);
  } catch (error) {
    console.error('Leaderboard error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to load leaderboard', code: 'SERVER_ERROR' },
      { status: 500 },
      origin
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
