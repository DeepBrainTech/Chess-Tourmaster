/**
 * 后端 API 基地址。
 * 单仓部署时默认走同域（返回空字符串）；仅在跨域部署时设置 NEXT_PUBLIC_API_URL。
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/+$/, '') : '';
}
