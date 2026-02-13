// 前端生产: chess-tourmaster.deepbraintechnology.com；后端部署在 Railway（公网域名由 Railway 提供）
// 多源逗号分隔；未配置时允许所有源，避免线上因环境变量遗漏导致 CORS 直接失效
const corsAllowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function resolveAllowOrigin(requestOrigin: string | null): string {
  if (corsAllowedOrigins.includes('*')) return '*';
  if (requestOrigin && corsAllowedOrigins.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && corsAllowedOrigins.length === 0) return requestOrigin;
  if (corsAllowedOrigins.length > 0) return corsAllowedOrigins[0];
  return '*';
}

export function getCorsHeaders(requestOrigin?: string | null): HeadersInit {
  const allowOrigin = resolveAllowOrigin(requestOrigin ?? null);
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Origin, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
  };
  return headers;
}

export function withCors(response: Response, requestOrigin?: string | null): Response {
  const headers = getCorsHeaders(requestOrigin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, String(value));
  });
  return response;
}

export function jsonResponse(body: unknown, init?: ResponseInit, requestOrigin?: string | null): Response {
  return withCors(Response.json(body, init), requestOrigin);
}

export function optionsResponse(requestOrigin?: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin),
  });
}
