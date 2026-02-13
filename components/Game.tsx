'use client';

import { useEffect, useState } from 'react';

interface GameProps {
  token: string | null;
}

export default function Game({ token }: GameProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // 将原有的 HTML 内容插入到页面中
    const container = document.getElementById('game-container');
    if (!container) return;

    // 初始化游戏（将原有的游戏逻辑注入）
    initializeGame(token);
  }, [mounted, token]);

  if (!mounted) return null;

  return <div id="game-container" dangerouslySetInnerHTML={{ __html: getGameHTML() }} />;
}

function getGameHTML(): string {
  // 返回原有的游戏 HTML 结构（从 body 标签内的内容）
  return `
    <div id="player-info" style="position:absolute; top:10px; left:10px; color:white; font-size:18px;"></div>

    <div id="bg-blobs" class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="theme-blob w-96 h-96 bg-cyan-500 top-0 left-0"></div>
        <div class="theme-blob w-96 h-96 bg-purple-500 bottom-0 right-0 animation-delay-2000"></div>
    </div>

    <div class="z-10 w-full max-w-2xl px-4 mb-2 flex justify-between items-center">
        <div>
            <h1 class="text-xl md:text-3xl text-rose-500 font-bold fantasy-font tracking-wider shadow-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                <i class="fas fa-chess-board mr-2"></i>Tourmaster
            </h1>
            <div class="flex items-center gap-3 text-sm md:text-base text-gray-300 mt-1">
                <span id="mode-display" class="font-bold text-white">Classic Tour</span>
                <span class="text-gray-500">|</span>
                <span>Lvl <span id="level-display" class="font-bold text-white">1</span></span>
                <span class="text-gray-500">|</span>
                <span class="font-mono text-cyan-300"><i class="far fa-clock mr-1"></i><span id="game-timer">00:00</span></span>
            </div>
        </div>
        <div class="flex gap-2">
            <button onclick="game.showModeSelection(true)" class="bg-indigo-700/80 hover:bg-indigo-600 text-white p-2 rounded-lg shadow-lg border border-indigo-500" title="Change Mode">
                <i class="fas fa-gamepad"></i>
            </button>
            <button onclick="game.undo()" class="bg-slate-700/80 hover:bg-slate-600 text-white p-2 rounded-lg shadow-lg border border-slate-500" title="Undo">
                <i class="fas fa-undo"></i>
            </button>
            <button onclick="game.restartLevel()" class="bg-slate-700/80 hover:bg-slate-600 text-white p-2 rounded-lg shadow-lg border border-slate-500" title="Restart">
                <i class="fas fa-redo"></i>
            </button>
            <button onclick="game.toggleSettings()" class="bg-indigo-700/80 hover:bg-indigo-600 text-white p-2 rounded-lg shadow-lg border border-indigo-500" title="Settings">
                <i class="fas fa-cog"></i>
            </button>
            <button onclick="toggleHelp()" class="bg-rose-700/80 hover:bg-rose-600 text-white p-2 rounded-lg shadow-lg border border-rose-500" title="Help">
                <i class="fas fa-question"></i>
            </button>
        </div>
    </div>

    <div class="z-10 w-full max-w-2xl px-4 mb-2 flex flex-wrap justify-between items-center h-8">
        <div class="text-cyan-300 font-bold text-sm md:text-lg flex items-center bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
            Tiles Left: <span id="tiles-left" class="ml-2 text-white">0</span>
        </div>
        
        <div id="quest-score-container" class="hidden text-amber-300 font-bold text-sm md:text-lg flex items-center bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700">
            Score: <span id="current-score" class="ml-1 text-white">0</span> / <span id="required-score" class="text-white">0</span>
        </div>

        <div id="fire-timer-container" class="hidden flex items-center gap-2 text-orange-500 bg-black/60 px-3 py-1 rounded-full border border-orange-900/50">
            <i class="fas fa-fire animate-pulse"></i>
            <div class="w-24 h-3 bg-gray-800 rounded-full overflow-hidden border border-orange-900 shadow-inner">
                <div id="fire-bar" class="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 w-full fire-timer-bar"></div>
            </div>
        </div>
    </div>

    <div class="z-10 relative bg-slate-800/60 p-2 md:p-3 rounded-xl shadow-2xl border-4 border-slate-600 backdrop-blur-md w-full max-w-[95vw] md:max-w-2xl aspect-square flex items-center justify-center mx-auto">
        <div id="game-board" class="grid gap-1 bg-slate-900 p-2 rounded-lg select-none w-full h-full"></div>
        
        <div id="message-overlay" class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300 z-50">
            <h2 class="text-4xl md:text-6xl font-bold text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.9)] fantasy-font transform scale-150 transition-transform duration-300 text-center px-4" id="message-text"></h2>
        </div>
    </div>

    <div class="z-10 mt-4 text-center text-gray-400 text-xs">
        <p id="footer-goal">Goal: Clear board &rarr; Capture <span class="text-rose-500 font-bold">King</span></p>
    </div>

    <div id="main-modal" class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop hidden">
        <div class="bg-gray-800 border-2 border-rose-600 p-6 md:p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center m-4 relative">
            <div class="mb-4 text-6xl flex justify-center gap-4" id="modal-icon"></div>
            <h2 id="modal-title" class="text-3xl font-bold text-white mb-2 fantasy-font"></h2>
            <div id="modal-body" class="text-gray-300 mb-6 text-sm"></div>
            <div id="high-score-display" class="text-lg font-mono text-yellow-300 mb-4 fantasy-font hidden"></div> 
            <button id="modal-btn" class="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:scale-105">
                Action
            </button>
        </div>
    </div>

    <div id="settings-modal" class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop hidden" onclick="game.toggleSettings()">
        <div class="bg-gray-800 border-2 border-indigo-500 p-6 rounded-2xl shadow-2xl max-w-xs w-full m-4" onclick="event.stopPropagation()">
            <h3 class="text-xl font-bold text-indigo-400 mb-4 fantasy-font text-center">Select Theme</h3>
            <div class="grid grid-cols-2 gap-3">
                <button onclick="game.setTheme('cosmic')" class="p-3 rounded-lg bg-indigo-900 border border-indigo-700 hover:bg-indigo-800 text-white text-sm">Cosmic</button>
                <button onclick="game.setTheme('royal')" class="p-3 rounded-lg bg-purple-900 border border-purple-700 hover:bg-purple-800 text-white text-sm">Royal</button>
                <button onclick="game.setTheme('nature')" class="p-3 rounded-lg bg-emerald-900 border border-emerald-700 hover:bg-emerald-800 text-white text-sm">Nature</button>
                <button onclick="game.setTheme('inferno')" class="p-3 rounded-lg bg-red-900 border border-red-700 hover:bg-red-800 text-white text-sm">Inferno</button>
                <button onclick="game.setTheme('desert')" class="p-3 rounded-lg bg-yellow-800 border border-yellow-600 hover:bg-yellow-700 text-white text-sm">Desert</button>
                <button onclick="game.setTheme('frost')" class="p-3 rounded-lg bg-blue-700 border border-blue-500 hover:bg-blue-600 text-white text-sm">Frost</button>
                <button onclick="game.setTheme('volcanic')" class="p-3 rounded-lg bg-zinc-700 border border-zinc-500 hover:bg-zinc-600 text-white text-sm">Volcanic</button>
            </div>
            <button onclick="game.toggleSettings()" class="mt-6 w-full bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-600 text-sm">Close</button>
        </div>
    </div>

    <div id="help-modal" class="fixed inset-0 z-50 flex items-center justify-center modal-backdrop hidden" onclick="toggleHelp()">
        <div class="bg-slate-800 border-2 border-slate-500 p-6 rounded-2xl shadow-2xl max-w-sm w-full m-4" onclick="event.stopPropagation()">
            <h3 class="text-2xl font-bold text-rose-500 mb-4 fantasy-font border-b border-slate-600 pb-2" id="help-modal-title">Instructions (Classic Tour)</h3>
            <ul id="help-modal-body" class="text-left text-gray-300 space-y-3 text-sm"></ul>
            <button onclick="toggleHelp()" class="mt-6 w-full bg-slate-700 text-white py-2 rounded-lg">Close</button>
        </div>
    </div>
  `;
}

function initializeGame(token: string | null) {
  // 注入游戏样式
  const styleElement = document.createElement('style');
  styleElement.innerHTML = getGameStyles();
  document.head.appendChild(styleElement);

  // 注入游戏脚本
  const scriptElement = document.createElement('script');
  scriptElement.innerHTML = getGameScript(token);
  document.body.appendChild(scriptElement);
}

function getGameStyles(): string {
  return `
    /* 继续使用原有的游戏样式 */
    /* Board Styling */
    #game-board {
        background-image: repeating-linear-gradient(45deg, #1e293b 25%, transparent 25%, transparent 75%, #1e293b 75%, #1e293b), repeating-linear-gradient(45deg, #1e293b 25%, #0f172a 25%, #0f172a 75%, #1e293b 75%, #1e293b);
        background-position: 0 0, 10px 10px;
        background-size: 20px 20px;
        box-shadow: inset 0 0 20px #000;
    }

    .tile {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        aspect-ratio: 1 / 1;
        position: relative;
        border: 1px solid rgba(255, 255, 255, 0.15); 
    }

    /* Theme-specific styling - 保留原有的所有主题样式 */
    .bg-theme-cosmic #game-board {
        background-image: repeating-linear-gradient(45deg, #1e293b 25%, transparent 25%, transparent 75%, #1e293b 75%, #1e293b), repeating-linear-gradient(45deg, #1e293b 25%, #0f172a 25%, #0f172a 75%, #1e293b 75%, #1e293b);
    }
    .bg-theme-cosmic .tile:not(.visited):not(.king-tile) {
        background-color: #334155;
    }
    .bg-theme-cosmic .tile:not(.visited):not(.king-tile):hover {
        background-color: #475569;
    }

    .bg-theme-royal #game-board {
        background-image: repeating-linear-gradient(45deg, #37004d 25%, transparent 25%, transparent 75%, #37004d 75%, #37004d), repeating-linear-gradient(45deg, #37004d 25%, #1c0029 25%, #1c0029 75%, #37004d 75%, #37004d);
    }
    .bg-theme-royal .tile:not(.visited):not(.king-tile) {
        background-color: #4a044e;
        border-color: #6d28d9;
    }
    .bg-theme-royal .tile:not(.visited):not(.king-tile):hover {
        background-color: #6b21a8;
    }

    .bg-theme-nature #game-board {
        background-image: repeating-linear-gradient(45deg, #14532d 25%, transparent 25%, transparent 75%, #14532d 75%, #14532d), repeating-linear-gradient(45deg, #14532d 25%, #047857 25%, #047857 75%, #14532d 75%, #14532d);
    }
    .bg-theme-nature .tile:not(.visited):not(.king-tile) {
        background-color: #065f46;
        border-color: #10b981;
    }
    .bg-theme-nature .tile:not(.visited):not(.king-tile):hover {
        background-color: #059669;
    }

    .bg-theme-inferno #game-board {
        background-image: repeating-linear-gradient(45deg, #7f1d1d 25%, transparent 25%, transparent 75%, #7f1d1d 75%, #7f1d1d), repeating-linear-gradient(45deg, #7f1d1d 25%, #450a0a 25%, #450a0a 75%, #7f1d1d 75%, #7f1d1d);
    }
    .bg-theme-inferno .tile:not(.visited):not(.king-tile) {
        background-color: #b91c1c;
        border-color: #f87171;
    }
    .bg-theme-inferno .tile:not(.visited):not(.king-tile):hover {
        background-color: #dc2626;
    }
    
    .bg-theme-desert #game-board {
        background-image: repeating-linear-gradient(45deg, #78350f 25%, transparent 25%, transparent 75%, #78350f 75%, #78350f), repeating-linear-gradient(45deg, #78350f 25%, #4a2107 25%, #4a2107 75%, #78350f 75%, #78350f);
    }
    .bg-theme-desert .tile:not(.visited):not(.king-tile) {
        background-color: #92400e;
        border-color: #fbbf24;
    }
    .bg-theme-desert .tile:not(.visited):not(.king-tile):hover {
        background-color: #b45309;
    }
    
    .bg-theme-frost #game-board {
        background-image: repeating-linear-gradient(45deg, #1e3a8a 25%, transparent 25%, transparent 75%, #1e3a8a 75%, #1e3a8a), repeating-linear-gradient(45deg, #1e3a8a 25%, #3b82f6 25%, #3b82f6 75%, #1e3a8a 75%, #1e3a8a);
    }
    .bg-theme-frost .tile:not(.visited):not(.king-tile) {
        background-color: #60a5fa;
        border-color: #eff6ff;
    }
    .bg-theme-frost .tile:not(.visited):not(.king-tile):hover {
        background-color: #3b82f6;
    }
    
    .bg-theme-volcanic #game-board {
        background-image: repeating-linear-gradient(45deg, #3f3f46 25%, transparent 25%, transparent 75%, #3f3f46 75%, #3f3f46), repeating-linear-gradient(45deg, #3f3f46 25%, #18181b 25%, #18181b 75%, #3f3f46 75%, #3f3f46);
    }
    .bg-theme-volcanic .tile:not(.visited):not(.king-tile) {
        background-color: #52525b;
        border-color: #a1a1aa;
    }
    .bg-theme-volcanic .tile:not(.visited):not(.king-tile):hover {
        background-color: #3f3f46;
    }

    .tile.visited {
        background-color: #020617 !important;
        border-color: #1e293b !important;
        box-shadow: inset 0 0 15px #000;
        transform: scale(0.92);
        opacity: 0.6;
    }

    .tile.valid-move {
        background-color: rgba(34, 197, 94, 0.15);
        box-shadow: 0 0 20px rgba(34, 197, 94, 0.3), inset 0 0 10px rgba(34, 197, 94, 0.1);
        border-color: #4ade80;
        cursor: pointer;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
        70% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
    }

    .fire-anim {
        animation: burn 0.6s infinite alternate ease-in-out;
        filter: drop-shadow(0 0 8px #f97316);
    }
    @keyframes burn {
        from { transform: scale(1) translateY(0); filter: drop-shadow(0 0 5px #f97316); }
        to { transform: scale(1.15) translateY(-2px); filter: drop-shadow(0 0 12px #ea580c); }
    }

    .knight-piece {
        animation: bounce 2s infinite ease-in-out;
        filter: drop-shadow(0 0 10px cyan);
        position: relative; 
        z-index: 50;
    }
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
    }

    .king-piece {
        animation: floatKing 3s infinite ease-in-out;
        filter: drop-shadow(0 0 15px #e11d48);
        position: relative;
        z-index: 40;
    }
    @keyframes floatKing {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-6px) scale(1.1); }
    }
    .king-tile {
        border-color: #e11d48 !important;
        box-shadow: 0 0 20px rgba(225, 29, 72, 0.3);
        background-color: #3f1018 !important;
    }
    
    .quest-value {
        position: absolute;
        top: 2px;
        right: 4px;
        font-size: 0.75rem;
        font-weight: bold;
        color: #fcd34d;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        transition: transform 0.2s;
    }
    .valid-move .quest-value {
        transform: scale(1.1);
        color: #4ade80;
    }

    .star-pop {
        animation: starPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
    }
    @keyframes starPop {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }

    .modal-backdrop {
        background-color: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
    }

    .shake {
        animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
        40%, 60% { transform: translate3d(4px, 0, 0); }
    }
    
    .fire-timer-bar {
        transition: width 0.1s linear;
    }

    .bg-theme-cosmic {
        background: radial-gradient(circle at center, #1e1b4b 0%, #020617 100%);
    }
    .bg-theme-royal {
        background: linear-gradient(135deg, #4a044e 0%, #2e1065 100%);
    }
    .bg-theme-nature {
        background: linear-gradient(to bottom, #064e3b 0%, #022c22 100%);
    }
    .bg-theme-inferno {
        background: radial-gradient(circle at bottom, #7f1d1d 0%, #450a0a 100%);
    }
    .bg-theme-desert {
        background: linear-gradient(to top, #92400e 0%, #4a2107 100%);
    }
    .bg-theme-frost {
        background: linear-gradient(to top, #60a5fa 0%, #1e3a8a 100%);
    }
    .bg-theme-volcanic {
        background: radial-gradient(circle at center, #3f3f46 0%, #18181b 100%);
    }

    .theme-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.3;
        animation: blobFloat 10s infinite alternate;
    }
    @keyframes blobFloat {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(20px, -20px) scale(1.1); }
    }
  `;
}

function getGameScript(token: string | null): string {
  // 将原有的游戏脚本嵌入，但修改 saveProgress 和 loadProgress 函数
  return `
    (function() {
      // 设置全局 token
      window.GAME_TOKEN = ${JSON.stringify(token)};
      
      // 解码 JWT
      function decodeJwt(token) {
          try {
              if (!token) return null;
              const payload = token.split('.')[1];
              const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
              const json = decodeURIComponent(atob(base64).split('').map(c =>
                  '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
              ).join(''));
              return JSON.parse(json);
          } catch (err) {
              console.error("Error decoding JWT:", err);
              return null;
          }
      }

      const userData = decodeJwt(window.GAME_TOKEN);
      const USER_ID = userData ? userData.user_id : null;
      const USERNAME = userData ? userData.username : "Guest";

      console.log("User ID:", USER_ID);
      console.log("Username:", USERNAME);

      // 替换 saveProgress 为 API 调用
      window.saveProgress = async function(progressObj) {
          if (!USER_ID || !window.GAME_TOKEN) {
              console.warn("No user ID or token, cannot save progress");
              return;
          }

          try {
              const response = await fetch('/api/progress/save', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + window.GAME_TOKEN,
                  },
                  body: JSON.stringify({
                      high_score: progressObj.highScore,
                      total_levels: progressObj.totalLevels || 0,
                  }),
              });

              const data = await response.json();
              if (data.success) {
                  console.log("Progress saved:", data.data);
              } else {
                  console.error("Failed to save progress:", data.message);
              }
          } catch (error) {
              console.error("Error saving progress:", error);
          }
      };

      // 替换 loadProgress 为 API 调用
      window.loadProgress = async function() {
          if (!USER_ID || !window.GAME_TOKEN) {
              console.warn("No user ID or token, cannot load progress");
              return null;
          }

          try {
              const response = await fetch('/api/progress/load', {
                  method: 'GET',
                  headers: {
                      'Authorization': 'Bearer ' + window.GAME_TOKEN,
                  },
              });

              const data = await response.json();
              if (data.success) {
                  console.log("Progress loaded:", data.data);
                  return {
                      highScore: data.data.high_score || 0,
                      totalLevels: data.data.total_levels || 0,
                  };
              } else {
                  console.error("Failed to load progress:", data.message);
                  return null;
              }
          } catch (error) {
              console.error("Error loading progress:", error);
              return null;
          }
      };

      // 显示玩家信息
      document.getElementById("player-info").innerText = "Player: " + USERNAME;
      
      // 初始化游戏主体逻辑（将原有的完整游戏逻辑注入）
      ${getOriginalGameLogic()}
    })();
  `;
}

// 从原有的 index.html 中提取游戏逻辑
function getOriginalGameLogic(): string {
  // 这里需要放置原有 index.html 中 <script> 标签内的完整游戏逻辑
  // 由于代码太长，我会在下一个文件中创建
  return `
    // 游戏逻辑将在下一步注入
    console.log("Game logic loading...");
  `;
}
