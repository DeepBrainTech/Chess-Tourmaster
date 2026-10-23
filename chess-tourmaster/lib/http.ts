export function getCorsHeaders(requestOrigin?: string | null): HeadersInit {
  // 未配置白名单时不允许跨域；同源请求不受影响。
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Origin, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
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
