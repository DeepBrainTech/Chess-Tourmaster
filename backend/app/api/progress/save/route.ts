import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';

/**
 * 保存游戏进度
 * POST /api/progress/save
 * Body: { 
 *   high_score: number, 
 *   total_levels?: number,
 *   best_moves?: number,
 *   total_moves?: number,
 *   level_data?: { level, moves_count, time_seconds, score, stars, game_mode }
 * }
 */
export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const body = await request.json();
    const { high_score, total_levels, best_moves, total_moves, level_data } = body;

    if (typeof high_score !== 'number' || high_score < 0) {
      return jsonResponse(
        { success: false, message: 'Invalid high_score', code: 'INVALID_DATA' },
        { status: 400 },
        origin
      );
    }

    // 更新或创建游戏进度
    const updateData: any = {
      high_score: high_score,
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
        high_score: high_score,
        total_levels: total_levels ?? 0,
        best_moves: best_moves,
        total_moves: total_moves ?? 0,
      },
    });

    // 如果提供了关卡数据，保存关卡记录
    if (level_data && typeof level_data === 'object') {
      await prisma.levelRecord.create({
        data: {
          portal_user_id: payload.user_id,
          username: payload.username,
          level: level_data.level || 1,
          moves_count: level_data.moves_count || 0,
          time_seconds: level_data.time_seconds || 0,
          score: level_data.score || 0,
          stars: level_data.stars || 1,
          game_mode: level_data.game_mode || 'classic',
        },
      });
    }

    // 同时更新排行榜快照
    await prisma.leaderboard.create({
      data: {
        portal_user_id: payload.user_id,
        username: payload.username,
        high_score: high_score,
      },
    });

    return jsonResponse({
      success: true,
      message: 'Progress saved successfully',
      data: {
        high_score: progress.high_score,
        total_levels: progress.total_levels,
        best_moves: progress.best_moves,
        total_moves: progress.total_moves,
      },
    }, undefined, origin);
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
