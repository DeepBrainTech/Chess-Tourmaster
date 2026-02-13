/**
 * 后端 API 基地址（前端部署在 Pages 时需在构建环境设置 NEXT_PUBLIC_API_URL 为 Railway 后端地址）
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}
