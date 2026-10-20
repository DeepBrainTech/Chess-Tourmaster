import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { ensureUserHint } from '@/lib/userHint';

export const GET = requireAuth(async (request: NextRequest, payload) => {
  try {
    const data = await ensureUserHint(payload.user_id, payload.username);
    return jsonResponse({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } }, request.headers.get('Origin'));
  } catch {
    return jsonResponse({ success: false, code: 'SERVER_ERROR', message: 'Could not load inventory' }, { status: 500 }, request.headers.get('Origin'));
  }
});

export function OPTIONS(request: NextRequest) { return optionsResponse(request.headers.get('Origin')); }
