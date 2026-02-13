// 前端生产: chess-tourmaster.deepbraintechnology.com；后端部署在 Railway（公网域名由 Railway 提供）
// 多源逗号分隔，不设则用下方默认（生产站优先）
const corsAllowedOrigins = (process.env.CORS_ORIGIN || 'https://chess-tourmaster.deepbraintechnology.com,https://chess-tourmaster.pages.dev')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function resolveAllowOrigin(requestOrigin: string | null): string {
  if (requestOrigin && corsAllowedOrigins.includes(requestOrigin)) return requestOrigin
  if (corsAllowedOrigins.length > 0) return corsAllowedOrigins[0]
  return ''
}

export function getCorsHeaders(requestOrigin?: string | null): HeadersInit {
  const allowOrigin = resolveAllowOrigin(requestOrigin ?? null)
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
  if (allowOrigin) {
    (headers as Record<string, string>)['Access-Control-Allow-Origin'] = allowOrigin
  }
  return headers
}

export function withCors(response: Response, requestOrigin?: string | null): Response {
  const headers = getCorsHeaders(requestOrigin)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, String(value))
  })
  return response
}

export function jsonResponse(body: unknown, init?: ResponseInit, requestOrigin?: string | null): Response {
  return withCors(Response.json(body, init), requestOrigin)
}

export function optionsResponse(requestOrigin?: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin),
  })
}
