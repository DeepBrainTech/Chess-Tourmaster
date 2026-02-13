const corsOrigin = process.env.CORS_ORIGIN || '*'

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
