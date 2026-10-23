'use client';

import { useEffect, useState } from 'react';
import { captureLaunchContext, portalSession } from '@/lib/portal-session';
import type { LaunchContext, PortalUser } from '@/lib/portal-session';

let launch: LaunchContext | null = null;

export function usePortalSession() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [context, setContext] = useState<LaunchContext | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    launch ??= captureLaunchContext();
    setContext(launch);
    void portalSession.bootstrap(launch.token, launch.portalLocale)
      .then(value => { if (!cancelled) setUser(value); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const refresh = () => { void portalSession.refresh(); };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [user]);
  return { user, context, loading };
}
