/**
 * 后端 API 基地址。
 * 单仓部署时默认走同域（返回空字符串）；仅在跨域部署时设置 NEXT_PUBLIC_API_URL。
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configured && configured.length > 0 ? configured.replace(/\/+$/, '') : '';
}

export function getPortalApiBase(): string {
  return (process.env.NEXT_PUBLIC_PORTAL_API_BASE?.trim() || portalDefaultBase(8000, 'https://api.deepbraintechnology.com')).replace(/\/+$/, '');
}

export function getPortalBase(): string {
  const fallback = portalDefaultBase(3000, 'https://deepbraintechnology.com');
  return (process.env.NEXT_PUBLIC_PORTAL_URL?.trim() || fallback).replace(/\/+$/, '');
}

function portalDefaultBase(port: number, production: string): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return `http://${host}:${port}`;
    }
  }
  return production;
}

export function getPortalUrl(page: 'login' | 'braingames', locale = 'en'): string {
  const language = /^(zn|zh)(?:[-_]|$)/i.test(locale) ? 'zh' : 'en';
  return `${getPortalBase()}/${language}/${page}`;
}
