import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * 获取用户的关卡统计数据
 * GET /api/levels/stats?level=1
 */
export const GET = requireAuth(async (request: NextRequest, payload) => {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');

    if (level) {
      // 获取特定关卡的统计
      const levelNum = parseInt(level, 10);
      const records = await prisma.levelRecord.findMany({
        where: {
          portal_user_id: payload.user_id,
          level: levelNum,
        },
        orderBy: { completed_at: 'desc' },
        take: 10, // 最近10次记录
      });

      // 找出最佳记录
      const bestRecord = await prisma.levelRecord.findFirst({
        where: {
          portal_user_id: payload.user_id,
          level: levelNum,
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
      });
    } else {
      // 获取所有关卡的概览
      const allRecords = await prisma.levelRecord.findMany({
        where: { portal_user_id: payload.user_id },
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
          };
        }
        acc[record.level].attempts++;
        if (record.moves_count < acc[record.level].best_moves) {
          acc[record.level].best_moves = record.moves_count;
        }
        if (record.time_seconds < acc[record.level].best_time) {
          acc[record.level].best_time = record.time_seconds;
        }
        acc[record.level].total_stars = Math.max(acc[record.level].total_stars, record.stars);
        return acc;
      }, {});

      return jsonResponse({
        success: true,
        data: {
          levels: Object.values(levelStats),
          total_attempts: allRecords.length,
        },
      });
    }
  } catch (error) {
    console.error('Get level stats error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to get level stats', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
});

export function OPTIONS() {
  return optionsResponse();
}
