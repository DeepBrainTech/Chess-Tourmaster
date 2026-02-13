'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // 重定向到静态游戏页面，保留 hash 参数
    const hash = window.location.hash;
    window.location.href = `/game-original.html${hash}`;
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p>Loading Chess Tourmaster...</p>
      </div>
    </div>
  );
}
