// 固定允许的前端来源（不依赖环境变量）
const corsAllowedOrigins = [
  'https://chess-tourmaster.pages.dev',
  'https://chess-tourmaster.deepbraintechnology.com',
];

function resolveAllowOrigin(requestOrigin: string | null): string {
  if (requestOrigin && corsAllowedOrigins.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && corsAllowedOrigins.length === 0) return requestOrigin;
  if (corsAllowedOrigins.length > 0) return corsAllowedOrigins[0];
  return '';
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
