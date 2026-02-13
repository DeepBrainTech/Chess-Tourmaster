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

function decodeJwt(token: string): { user_id?: number; username?: string } | null {
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const params = getHashParams();
    const t = params.token || null;
    setToken(t);
    if (t) {
      const payload = decodeJwt(t);
      if (payload?.username) setUsername(payload.username);
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

  return <GamePage token={token} username={username} />;
}
