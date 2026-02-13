// 生产环境建议设为前端域名，如 https://chess-tourmaster.pages.dev；不设或设为 * 则允许任意来源
const corsOrigin = process.env.CORS_ORIGIN || 'chess-tourmaster.deepbraintechnology.com'

export function getCorsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export function withCors(response: Response): Response {
  const headers = getCorsHeaders()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, String(value))
  })
  return response
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return withCors(Response.json(body, init))
}

export function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  })
}
