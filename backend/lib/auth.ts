import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/http';

export interface TokenPayload {
  sub: string; // username
  user_id: number; // portal_user_id
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * 验证 JWT token（从主站签发的 tourmaster token）
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = process.env.TOURMASTER_JWT_SECRET || process.env.JWT_SECRET;
    
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * 从请求头中提取并验证 token
 */
export function getTokenFromRequest(request: NextRequest): TokenPayload | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  return verifyToken(token);
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
        { status: 401 }
      );
    }

    return handler(request, payload);
  };
}
