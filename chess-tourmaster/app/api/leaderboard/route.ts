import { NextRequest } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { loadLeaderboard } from '@/lib/leaderboard';
import { jsonResponse, optionsResponse } from '@/lib/http';

export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const noCache = { 'Cache-Control': 'no-store' };
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 10;
    const requestedMode = searchParams.get('mode');
    const mode = requestedMode === 'classic' || requestedMode === 'math_tour' ? requestedMode : null;
    const user = getTokenFromRequest(request);
    const data = await loadLeaderboard(mode, limit, user?.user_id ?? null);
    return jsonResponse({ success: true, message: 'Leaderboard loaded successfully', data },
      { headers: noCache }, origin);
  } catch (error) {
    console.error('Leaderboard error:', error);
    return jsonResponse({ success: false, message: 'Failed to load leaderboard', code: 'SERVER_ERROR' },
      { status: 500, headers: noCache }, origin);
  }
}

export function OPTIONS(request: NextRequest) { return optionsResponse(request.headers.get('Origin')); }
