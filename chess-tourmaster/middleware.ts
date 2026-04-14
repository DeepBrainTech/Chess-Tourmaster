import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCorsHeaders } from '@/lib/http';

/**
 * 统一处理 /api/* 的 CORS 预检（OPTIONS），确保跨域前端能通过预检。
 * GET/POST 的 CORS 头由各 API 的 jsonResponse 添加。
 */
export function middleware(request: NextRequest) {
  if (request.method !== 'OPTIONS') {
    return NextResponse.next();
  }
  const origin = request.headers.get('Origin');
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export const config = {
  matcher: '/api/:path*',
};
