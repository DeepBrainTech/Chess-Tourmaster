'use client';

import GamePage from '@/components/game/GamePage';
import ModesHome from '@/components/game/ModesHome';
import { getPortalUrl } from '@/lib/apiBase';
import { usePortalSession } from '@/hooks/usePortalSession';
import { getPortalLoginUrl } from '@/lib/portal-session';

export default function Home() {
  const { user, context, loading } = usePortalSession();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p>Loading Knightours Chess...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const login = () => window.location.assign(getPortalLoginUrl(context?.portalLocale));
    return (
      <ModesHome
        portalUrl={getPortalUrl('braingames', context?.portalLocale)}
        onLogin={login}
        onPlay={login}
        onLeaderboard={login}
        onHelp={login}
        onSettings={login}
      />
    );
  }

  return (
    <GamePage
      key={user.user_id}
      accountId={user.user_id}
      username={user.username}
      locale={context?.locale}
      portalLocale={context?.portalLocale}
      initialPortalAssets={context?.assets ?? null}
    />
  );
}
