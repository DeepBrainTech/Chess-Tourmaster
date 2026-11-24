import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { MAX_LEVELS } from '@/lib/game/rules';
import { jsonResponse, optionsResponse } from '@/lib/http';

const RECENT_CLEARS_LIMIT = 10;

/**
 * 获取用户的关卡统计数据
 * GET /api/levels/stats?level=1
 */
export const GET = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const levelNum = level ? parseInt(level, 10) : undefined;
    const gameMode = searchParams.get('game_mode');
    const modeFilter = gameMode === 'classic' || gameMode === 'math_tour' ? gameMode : null;
    const where = {
      portal_user_id: payload.user_id,
      level: { gte: 1, lte: MAX_LEVELS, equals: levelNum },
      ...(modeFilter ? { game_mode: modeFilter } : {}),
    };

    const bests = await prisma.levelBest.groupBy({
      by: ['level'],
      where,
      orderBy: { level: 'asc' },
      _sum: { clear_count: true },
      _min: { best_moves: true, best_time_seconds: true },
      _max: { best_stars: true },
    });

    if (levelNum !== undefined) {
      const [archived, recent] = await Promise.all([
        prisma.levelRecord.findMany({ where, orderBy: { completed_at: 'desc' }, take: RECENT_CLEARS_LIMIT }),
        prisma.gameAttempt.findMany({
          where: { ...where, summarized: true, finished_at: { not: null } },
          orderBy: { finished_at: 'desc' },
          take: RECENT_CLEARS_LIMIT,
        }),
      ]);
      const recentRecords = recent.map(attempt => ({
        id: attempt.id,
        portal_user_id: attempt.portal_user_id,
        username: payload.username,
        level: attempt.level,
        moves_count: attempt.moves_count,
        time_seconds: Math.floor(attempt.active_ms / 1000),
        stars: attempt.stars,
        game_mode: attempt.game_mode,
        completed_at: attempt.finished_at!,
      }));
      const latest = [...archived, ...recentRecords]
        .sort((a, b) => b.completed_at.getTime() - a.completed_at.getTime())
        .slice(0, RECENT_CLEARS_LIMIT);

      return jsonResponse({
        success: true,
        data: {
          level: levelNum,
          records: latest,
          best_moves: bests[0]?._min.best_moves ?? null,
          best_time: bests[0]?._min.best_time_seconds ?? null,
          attempts: latest.length,
        },
      }, undefined, origin);
    } else {
      const levels = bests.map(best => ({
        level: best.level,
        attempts: best._sum.clear_count ?? 0,
        best_moves: best._min.best_moves,
        best_time: best._min.best_time_seconds,
        total_stars: best._max.best_stars,
        best_stars: best._max.best_stars,
      }));

      return jsonResponse({
        success: true,
        data: {
          levels,
          total_attempts: levels.reduce((total, level) => total + level.attempts, 0),
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
