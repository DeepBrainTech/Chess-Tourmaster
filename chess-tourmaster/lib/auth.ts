import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/http';

export interface TokenPayload {
  sub: string; // username
  user_id: number; // portal_user_id
  username: string;
  iat?: number;
  exp?: number;
}

export const SESSION_COOKIE_NAME = 'tourmaster_session';
export const SESSION_EXPIRE_SECONDS = 86400;

function validIdentity(decoded: string | jwt.JwtPayload): decoded is jwt.JwtPayload & TokenPayload {
  return typeof decoded !== 'string' && Number.isSafeInteger(decoded.user_id)
    && decoded.user_id > 0 && typeof decoded.username === 'string' && !!decoded.username.trim()
    && Number.isSafeInteger(decoded.exp) && !('purpose' in decoded);
}

export function issueSessionToken(user: TokenPayload): string {
  const secret = process.env.TOURMASTER_SESSION_JWT_SECRET || process.env.TOURMASTER_JWT_SECRET;
  if (!secret) throw new Error('Session signing not configured');
  return jwt.sign({ sub: user.sub || user.username, user_id: user.user_id,
    username: user.username, typ: 'tourmaster_session' }, secret, {
    algorithm: 'HS256', audience: 'chess-tourmaster-session', issuer: 'chess-tourmaster-backend',
    expiresIn: SESSION_EXPIRE_SECONDS,
  });
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.TOURMASTER_SESSION_JWT_SECRET || process.env.TOURMASTER_JWT_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'],
      audience: 'chess-tourmaster-session', issuer: 'chess-tourmaster-backend' });
    return validIdentity(decoded) && decoded.typ === 'tourmaster_session' ? decoded : null;
  } catch { return null; }
}

/**
 * 验证 JWT token（从主站签发的 tourmaster token）
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.TOURMASTER_JWT_SECRET;
    
    if (!secret) {
      console.error('TOURMASTER_JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, secret, {
      algorithms: [(process.env.TOURMASTER_JWT_ALG || 'HS256') as jwt.Algorithm],
      audience: process.env.TOURMASTER_JWT_AUD || 'chess-tourmaster',
      issuer: process.env.TOURMASTER_JWT_ISS || 'main-portal',
    });
    if (!validIdentity(decoded)) return null;
    return decoded as TokenPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * 优先验证显式 Bearer，避免旧 Cookie 将新账号的请求归到另一个用户。
 * 没有 Bearer 时支持游戏后端签发的 HttpOnly 会话 Cookie。
 */
export function getTokenFromRequest(request: NextRequest): TokenPayload | null {
  const authHeader = request.headers.get('authorization');
  
  if (authHeader) {
    return authHeader.startsWith('Bearer ') ? verifyToken(authHeader.substring(7)) : null;
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  // Cookie 认证的写操作只接受同源或明确配置的前端来源。
  const origin = request.headers.get('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin
    && origin !== request.nextUrl.origin
    && !(process.env.CORS_ORIGINS ?? '').split(',').map(value => value.trim()).includes(origin)) {
    return null;
  }
  return verifySessionToken(token);
}

/**
 * API 路由认证中间件
 */
export function requireAuth(handler: (request: NextRequest, payload: TokenPayload) => Promise<Response>) {
  return async (request: NextRequest) => {
    const payload = getTokenFromRequest(request);
    
    if (!payload) {
      return jsonResponse(
        { success: false, message: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
        request.headers.get('Origin')
      );
    }

    return handler(request, payload);
  };
}
