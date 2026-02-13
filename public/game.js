// 游戏主逻辑文件
// 从原始 index.html 中提取的完整游戏逻辑

// 声明全局变量
let USER_ID = null;
let USERNAME = "Guest";
let GAME_TOKEN = null;

// 初始化函数
function initGame() {
    // 从 window 对象获取 token
    GAME_TOKEN = window.GAME_TOKEN || null;
    
    // 解码 JWT
    if (GAME_TOKEN) {
        const userData = decodeJwt(GAME_TOKEN);
        if (userData) {
            USER_ID = userData.user_id;
            USERNAME = userData.username;
        }
    }

    console.log("Game initialized. User:", USERNAME, "ID:", USER_ID);
    
    // 更新玩家信息显示
    const playerInfo = document.getElementById("player-info");
    if (playerInfo) {
        playerInfo.innerText = `Player: ${USERNAME}`;
    }
}

// JWT 解码函数
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

// 保存进度（调用 API）
async function saveProgress(progressObj) {
    if (!USER_ID || !GAME_TOKEN) {
        console.warn("No user ID or token, cannot save progress");
        return;
    }

    try {
        const response = await fetch('/api/progress/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GAME_TOKEN}`,
            },
            body: JSON.stringify({
                high_score: progressObj.highScore,
                total_levels: progressObj.totalLevels || 0,
            }),
        });

        const data = await response.json();
        if (data.success) {
            console.log("Progress saved successfully:", data.data);
        } else {
            console.error("Failed to save progress:", data.message);
        }
    } catch (error) {
        console.error("Error saving progress:", error);
    }
}

// 加载进度（调用 API）
async function loadProgress() {
    if (!USER_ID || !GAME_TOKEN) {
        console.warn("No user ID or token, cannot load progress");
        return null;
    }

    try {
        const response = await fetch('/api/progress/load', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${GAME_TOKEN}`,
            },
        });

        const data = await response.json();
        if (data.success) {
            console.log("Progress loaded successfully:", data.data);
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
}

// 音效管理器
const sound = {
    ctx: null,
    init() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    },
    playTone(freq, type, duration, vol=0.1) {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playMove() {
        this.playTone(300, 'sine', 0.15, 0.2);
        setTimeout(() => this.playTone(100, 'square', 0.2, 0.1), 100); 
    },
    playCollect() {
        this.playTone(880, 'sine', 0.08, 0.2);
    },
    playVictory() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.4, 0.2), i * 150);
        });
    },
    playBurn() {
        this.speak("You are cooked");
        this.playTone(100, 'sawtooth', 0.5, 0.2);
    },
    speak(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance(text);
            msg.rate = 1.2; 
            msg.pitch = 1.0;
            window.speechSynthesis.speak(msg);
        }
    }
};

// 导出到全局
window.initGame = initGame;
window.sound = sound;
window.saveProgress = saveProgress;
window.loadProgress = loadProgress;

// 页面加载后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
