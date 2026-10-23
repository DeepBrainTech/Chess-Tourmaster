'use client';

import GamePage from '@/components/game/GamePage';
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
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-950 text-white px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-bold mb-3">Login Required</h1>
          <p className="text-slate-300 mb-6">Please login to start playing Knightours Chess.</p>
          <a
            href={getPortalLoginUrl(context?.portalLocale)}
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
      key={user.user_id}
      accountId={user.user_id}
      username={user.username}
      locale={context?.locale}
      portalLocale={context?.portalLocale}
      initialPortalAssets={context?.assets ?? null}
    />
  );
}
