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
    const sort = searchParams.get('sort') || 'score';
    const mode = searchParams.get('mode');

    if (sort === 'levels' && (mode === 'classic' || mode === 'math_tour')) {
      const safeLimit = Math.min(Math.max(limit, 1), 100);
      const modeLeaderboard = await prisma.$queryRaw<
        Array<{
          portal_user_id: number;
          username: string;
          total_levels: bigint | number;
          updated_at: Date;
        }>
      >`
        SELECT
          portal_user_id,
          username,
          COUNT(DISTINCT level)::bigint AS total_levels,
          MAX(completed_at) AS updated_at
        FROM level_records
        WHERE game_mode = ${mode}
        GROUP BY portal_user_id, username
        ORDER BY total_levels DESC, updated_at ASC
        LIMIT ${safeLimit}
      `;

      const rankedModeLeaderboard = modeLeaderboard.map((entry, index) => ({
        ...entry,
        total_levels: Number(entry.total_levels),
        rank: index + 1,
      }));

      return jsonResponse({
        success: true,
        message: 'Leaderboard loaded successfully',
        data: rankedModeLeaderboard,
      }, undefined, origin);
    }

    const orderBy =
      sort === 'levels'
        ? [{ total_levels: 'desc' as const }, { high_score: 'desc' as const }, { updated_at: 'asc' as const }]
        : [{ high_score: 'desc' as const }, { total_levels: 'desc' as const }, { updated_at: 'asc' as const }];

    const leaderboard = await prisma.gameProgress.findMany({
      orderBy,
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
