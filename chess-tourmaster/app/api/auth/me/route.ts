import { requireAuth, SESSION_EXPIRE_SECONDS } from '@/lib/auth';
import { jsonResponse } from '@/lib/http';

export const GET = requireAuth(async (request, user) => jsonResponse({ success: true, user: {
  user_id: user.user_id, portal_user_id: user.user_id, username: user.username,
}, sessionExpiresIn: SESSION_EXPIRE_SECONDS }, { headers: { 'Cache-Control': 'no-store' } }, request.headers.get('Origin')));
