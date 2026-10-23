import { getApiBase, getPortalApiBase, getPortalUrl } from './apiBase';

export type PortalUser = { user_id: number; username: string };
export type PortalLocale = 'en' | 'zn';
export type LaunchContext = {
  token: string | null;
  locale: string | null;
  portalLocale: PortalLocale;
  assets: { coins: number; diamonds: number; flowers: number } | null;
};

export function captureLaunchContext(): LaunchContext {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const locale = hash.get('locale') ?? query.get('locale');
  let savedLocale: string | null = null;
  try { savedLocale = sessionStorage.getItem('chess-tourmaster:portalLocale'); } catch { /* Optional storage. */ }
  const language = hash.get('portalLocale') ?? query.get('portalLocale') ?? locale ?? savedLocale ?? 'en';
  const portalLocale = /^(zn|zh)(?:[-_]|$)/i.test(language) ? 'zn' : 'en';
  try { sessionStorage.setItem('chess-tourmaster:portalLocale', portalLocale); } catch { /* Optional storage. */ }
  const balance = (key: string) => {
    const value = Number(hash.get(key) ?? 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  const assets = ['coins', 'diamonds', 'flowers'].some(key => hash.has(key))
    ? { coins: balance('coins'), diamonds: balance('diamonds'), flowers: balance('flowers') } : null;
  const token = hash.get('token');
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return { token, locale, portalLocale, assets };
}

export function getPortalLoginUrl(locale = 'en'): string {
  return `${getPortalUrl('login', locale)}?next=${encodeURIComponent(window.location.href)}`;
}

/** Portal cookies obtain game tokens; the game backend verifies identity and issues its own cookie. */
export class PortalSessionClient {
  private token: string | null = null;
  private user: PortalUser | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private bootstrapPromise: Promise<PortalUser | null> | null = null;
  private locale: PortalLocale = 'en';
  private loginRequired = false;

  constructor(private readonly request: typeof fetch = (...args) => fetch(...args),
    private readonly redirect: (url: string) => void = url => { window.location.href = url; }) {}

  private login(): void {
    this.loginRequired = true;
    this.redirect(getPortalLoginUrl(this.locale));
  }

  private async verify(token: string): Promise<PortalUser> {
    const response = await this.request(`${getApiBase()}/api/auth/verify`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    const user = data?.user;
    if (!response.ok || !data?.success || !Number.isSafeInteger(user?.user_id)
      || user.user_id <= 0 || typeof user.username !== 'string') throw new Error('game_session_invalid');
    return user;
  }

  bootstrap(token: string | null, locale: PortalLocale): Promise<PortalUser | null> {
    if (this.bootstrapPromise) return this.bootstrapPromise;
    this.locale = locale;
    this.bootstrapPromise = (async () => {
      if (token) {
        try {
          this.user = await this.verify(token);
          this.token = token;
          return this.user;
        } catch { /* Expired launches can be restored through the portal cookie. */ }
      }
      if (await this.refresh(true)) return this.user;
      if (this.loginRequired) return null;
      const response = await this.request(`${getApiBase()}/api/auth/me`, {
        credentials: 'include', cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok && data?.success && Number.isSafeInteger(data.user?.user_id) && data.user.user_id > 0) {
        this.user = data.user;
        return this.user;
      }
      return null;
    })();
    return this.bootstrapPromise;
  }

  refresh(force = false): Promise<boolean> {
    if (!force && this.token) {
      try {
        const claims = JSON.parse(atob(this.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (claims.exp - Date.now() / 1000 > 45) return Promise.resolve(true);
      } catch { /* Malformed/expired tokens require a verified replacement. */ }
    }
    if (this.refreshPromise) return this.refreshPromise;
    const pending = (async () => {
      try {
        const response = await this.request(`${getPortalApiBase()}/api/games/chess-tourmaster/session`, {
          credentials: 'include', cache: 'no-store',
        });
        if (response.status === 401) { this.login(); return false; }
        const data = await response.json();
        const token = data?.data?.game_token;
        if (!response.ok || !data?.success || typeof token !== 'string' || !token) return false;
        if (this.user && data.data.user?.id !== this.user.user_id) {
          this.login();
          return false;
        }
        const user = await this.verify(token);
        if (this.user && user.user_id !== this.user.user_id) { this.login(); return false; }
        this.token = token;
        this.user = user;
        return true;
      } catch { return false; }
    })();
    const tracked = pending.finally(() => { if (this.refreshPromise === tracked) this.refreshPromise = null; });
    this.refreshPromise = tracked;
    return tracked;
  }

  async gameFetch(path: string, init: RequestInit = {}): Promise<Response> {
    if (this.loginRequired) throw new Error('portal_login_required');
    const send = () => {
      const headers = new Headers(init.headers);
      headers.delete('Authorization');
      if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
      return this.request(`${getApiBase()}${path}`, { ...init, headers, credentials: 'include' });
    };
    const response = await send();
    if (response.status !== 401 || !await this.refresh(true)) return response;
    return send();
  }
}

export const portalSession = new PortalSessionClient();
export const gameFetch = (path: string, init?: RequestInit) => portalSession.gameFetch(path, init);
