import { NextRequest, NextResponse } from 'next/server';
import { issueSessionToken, SESSION_COOKIE_NAME, SESSION_EXPIRE_SECONDS, verifyToken } from '@/lib/auth';
import { jsonResponse, optionsResponse, withCors } from '@/lib/http';
import { ensureUserHint } from '@/lib/userHint';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('Origin');
  const header = request.headers.get('Authorization');
  const user = header?.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  if (!user) return jsonResponse({ success: false, message: 'Invalid or expired token' }, { status: 401 }, origin);
  try {
    await ensureUserHint(user.user_id, user.username);
    const response = NextResponse.json({ success: true, user: {
      user_id: user.user_id, portal_user_id: user.user_id, username: user.username,
    }, sessionExpiresIn: SESSION_EXPIRE_SECONDS }, { headers: { 'Cache-Control': 'no-store' } });
    const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
    response.cookies.set(SESSION_COOKIE_NAME, issueSessionToken(user), {
      httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/', maxAge: SESSION_EXPIRE_SECONDS,
    });
    return withCors(response, origin);
  } catch {
    return jsonResponse({ success: false, message: 'Could not establish game session' }, { status: 500 }, origin);
  }
}

export function OPTIONS(request: NextRequest) { return optionsResponse(request.headers.get('Origin')); }
