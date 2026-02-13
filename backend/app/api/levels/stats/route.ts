import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * 获取用户的关卡统计数据
 * GET /api/levels/stats?level=1
 */
export const GET = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const gameMode = searchParams.get('game_mode');
    const modeFilter = gameMode === 'classic' || gameMode === 'math_tour' ? gameMode : null;

    if (level) {
      const levelNum = parseInt(level, 10);
      const records = await prisma.levelRecord.findMany({
        where: {
          portal_user_id: payload.user_id,
          level: levelNum,
          ...(modeFilter ? { game_mode: modeFilter } : {}),
        },
        orderBy: { completed_at: 'desc' },
        take: 10,
      });

      const bestRecord = await prisma.levelRecord.findFirst({
        where: {
          portal_user_id: payload.user_id,
          level: levelNum,
          ...(modeFilter ? { game_mode: modeFilter } : {}),
        },
        orderBy: { moves_count: 'asc' },
      });

      return jsonResponse({
        success: true,
        data: {
          level: levelNum,
          records: records,
          best_moves: bestRecord?.moves_count || null,
          best_time: bestRecord?.time_seconds || null,
          attempts: records.length,
        },
      }, undefined, origin);
    } else {
      // 获取所有关卡的概览
      const allRecords = await prisma.levelRecord.findMany({
        where: {
          portal_user_id: payload.user_id,
          ...(modeFilter ? { game_mode: modeFilter } : {}),
        },
        orderBy: { level: 'asc' },
      });

      // 按关卡分组统计
      const levelStats = allRecords.reduce((acc: any, record) => {
        if (!acc[record.level]) {
          acc[record.level] = {
            level: record.level,
            attempts: 0,
            best_moves: record.moves_count,
            best_time: record.time_seconds,
            total_stars: 0,
            best_stars: 0,
          };
        }
        acc[record.level].attempts++;
        if (record.moves_count < acc[record.level].best_moves) {
          acc[record.level].best_moves = record.moves_count;
        }
        if (record.time_seconds < acc[record.level].best_time) {
          acc[record.level].best_time = record.time_seconds;
        }
        const levelBestStars = Math.max(acc[record.level].best_stars, record.stars);
        acc[record.level].best_stars = levelBestStars;
        // Keep legacy field for compatibility with existing frontend usage.
        acc[record.level].total_stars = levelBestStars;
        return acc;
      }, {});

      return jsonResponse({
        success: true,
        data: {
          levels: Object.values(levelStats),
          total_attempts: allRecords.length,
        },
      }, undefined, origin);
    }
  } catch (error) {
    console.error('Get level stats error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to get level stats', code: 'SERVER_ERROR' },
      { status: 500 },
      origin
    );
  }
});

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
