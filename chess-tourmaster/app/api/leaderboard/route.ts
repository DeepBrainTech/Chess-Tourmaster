import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * Leaderboard by cleared levels.
 * GET /api/leaderboard?mode=classic|math_tour&limit=10
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const mode = searchParams.get('mode');
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    if (mode === 'classic' || mode === 'math_tour') {
      const rows = await prisma.$queryRaw<
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

      return jsonResponse(
        {
          success: true,
          message: 'Leaderboard loaded successfully',
          data: rows.map((entry, index) => ({
            ...entry,
            total_levels: Number(entry.total_levels),
            rank: index + 1,
          })),
        },
        undefined,
        origin
      );
    }

    const rows = await prisma.$queryRaw<
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
        COUNT(DISTINCT CONCAT(game_mode, ':', level))::bigint AS total_levels,
        MAX(completed_at) AS updated_at
      FROM level_records
      GROUP BY portal_user_id, username
      ORDER BY total_levels DESC, updated_at ASC
      LIMIT ${safeLimit}
    `;

    return jsonResponse(
      {
        success: true,
        message: 'Leaderboard loaded successfully',
        data: rows.map((entry, index) => ({
          ...entry,
          total_levels: Number(entry.total_levels),
          rank: index + 1,
        })),
      },
      undefined,
      origin
    );
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
