/**
 * 后端 API 基地址（前端部署在 Pages 时需在构建环境设置 NEXT_PUBLIC_API_URL 为 Railway 后端地址）
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const fallback = 'https://chess-tourmaster-production.up.railway.app';
  return (configured && configured.length > 0 ? configured : fallback).replace(/\/+$/, '');
}
