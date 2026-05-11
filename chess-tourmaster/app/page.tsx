'use client';

import { useEffect, useState } from 'react';
import GamePage from '@/components/game/GamePage';

const DEV_TOKEN = '__dev__';
const DEV_USERNAME = 'DevUser';
const PORTAL_API = 'https://api.deepbraintechnology.com';
const GAME_KEY = 'chess-tourmaster';

type PortalAssets = {
  coins: number;
  diamonds: number;
  flowers: number;
};

function isLocalDev(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function decodeJwt(token: string): { user_id?: number; username?: string } | null {
  if (token === DEV_TOKEN) return { user_id: 0, username: DEV_USERNAME };
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null); // game_token
  const [locale, setLocale] = useState<string | null>(null);
  const [initialPortalAssets, setInitialPortalAssets] = useState<PortalAssets | null>(null);
  const [username, setUsername] = useState<string>('Guest');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let nextToken: string | null = null;
    let nextLocale: string | null = null;
    let nextPortalAssets: PortalAssets | null = null;

    // 1) 从 URL hash 里取值（避免 token 留在地址栏/历史记录中）
    const parseFromHash = () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      nextToken = hash.get('token'); // 首屏用的短期 game_token
      nextLocale = hash.get('locale');
      const hasAssets = hash.has('coins') || hash.has('diamonds') || hash.has('flowers');
      if (hasAssets) {
        const coins = Number(hash.get('coins') ?? 0);
        const diamonds = Number(hash.get('diamonds') ?? 0);
        const flowers = Number(hash.get('flowers') ?? 0);
        nextPortalAssets = {
          coins: Number.isFinite(coins) ? coins : 0,
          diamonds: Number.isFinite(diamonds) ? diamonds : 0,
          flowers: Number.isFinite(flowers) ? flowers : 0,
        };
      } else {
        nextPortalAssets = null;
      }
      // 读完立刻清掉 hash，避免 token 在浏览器历史/分析 SDK 里残留
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    // 2) bootstrap：没从主站带 token 就主动去主站换一个
    const bootstrapGameToken = async (): Promise<string | null> => {
      if (isLocalDev()) return DEV_TOKEN;
      const res = await fetch(`${PORTAL_API}/api/games/${GAME_KEY}/session`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.status === 401) {
        const next = encodeURIComponent(location.href);
        location.href = `https://deepbraintechnology.com/zh/login?next=${next}`;
        return null;
      }
      if (!res.ok) throw new Error('bootstrap_failed');
      const json = await res.json();
      return json.data.game_token;
    };

    const run = async () => {
      try {
        parseFromHash();

        if (!nextToken && isLocalDev()) {
          nextToken = DEV_TOKEN;
        }

        if (!nextToken) {
          setBootstrapping(true);
          nextToken = await bootstrapGameToken();
        }

        setLocale(nextLocale);
        setInitialPortalAssets(nextPortalAssets);
        setToken(nextToken);
      } catch {
        // 失败时会在渲染分支里落到 Login Required
      } finally {
        setBootstrapping(false);
      }
    };

    void run();
  }, [mounted]);

  // token 解码得到 username / 是否登录
  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      setIsAuthenticated(false);
      return;
    }
    const payload = decodeJwt(token);
    if (payload?.user_id !== undefined && payload?.username) {
      setUsername(payload.username);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, [mounted, token]);

  // 静默续期：每 4 分钟换一次 game_token（Cookie 鉴权，不带 Authorization）
  useEffect(() => {
    if (!mounted) return;
    if (!token) return;
    if (isLocalDev()) return;

    let cancelled = false;
    let renewing = false;

    const refreshGameToken = async () => {
      if (renewing || cancelled) return;
      renewing = true;
      try {
        const res = await fetch(`${PORTAL_API}/api/games/${GAME_KEY}/session`, {
          method: 'GET',
          credentials: 'include',
        });
        if (res.status === 401) {
          const next = encodeURIComponent(location.href);
          location.href = `https://deepbraintechnology.com/zh/login?next=${next}`;
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        const nextToken = json?.data?.game_token;
        if (typeof nextToken === 'string' && !cancelled) setToken(nextToken);
      } catch {
        // 非 401 失败：不打断当前游戏
      } finally {
        renewing = false;
      }
    };

    const interval = window.setInterval(() => {
      void refreshGameToken();
    }, 4 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mounted, token]);

  if (!mounted || bootstrapping) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p>Loading Chess Tourmaster...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-950 text-white px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold mb-3">Login Required</h1>
          <p className="text-slate-300 mb-6">Please login to start playing Chess Tourmaster.</p>
          <a
            href="https://deepbraintechnology.com"
            className="inline-flex items-center justify-center w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-3 font-semibold transition"
          >
            Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <GamePage
      token={token}
      username={username}
      locale={locale}
      initialPortalAssets={initialPortalAssets}
    />
  );
}
