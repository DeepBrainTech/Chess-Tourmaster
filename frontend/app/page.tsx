'use client';

import { useEffect, useState } from 'react';
import GamePage from '@/components/game/GamePage';

function getHashParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash.substring(1);
  const params: Record<string, string> = {};
  hash.split('&').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) params[key] = decodeURIComponent(value);
  });
  return params;
}

const DEV_TOKEN = '__dev__';
const DEV_USERNAME = 'DevUser';

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
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('Guest');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const params = getHashParams();
    let t = params.token || null;
    if (!t && isLocalDev()) t = DEV_TOKEN;
    setToken(t);
    if (t) {
      const payload = decodeJwt(t);
      if (payload?.user_id !== undefined && payload?.username) {
        setUsername(payload.username);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
    // 读完 token 后从 URL 移除 hash，避免留在地址栏与历史记录中
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [mounted]);

  if (!mounted) {
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
            href="https://game.deepbraintechnology.com"
            className="inline-flex items-center justify-center w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-3 font-semibold transition"
          >
            Login
          </a>
        </div>
      </div>
    );
  }

  return <GamePage token={token} username={username} />;
}
