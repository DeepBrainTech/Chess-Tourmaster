/**
 * 游戏 API 扩展
 * 添加步数追踪功能
 */

// 扩展保存进度函数，支持步数记录
async function saveProgressWithMoves(progressObj) {
    if (!USER_ID || !jwtToken) {
        console.warn("No user ID or token, cannot save progress");
        return;
    }

    try {
        const response = await fetch('/api/progress/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({
                high_score: progressObj.highScore,
                total_levels: progressObj.totalLevels || 0,
                best_moves: progressObj.bestMoves,
                total_moves: progressObj.totalMoves,
                level_data: progressObj.levelData ? {
                    level: progressObj.levelData.level,
                    moves_count: progressObj.levelData.movesCount,
                    time_seconds: progressObj.levelData.timeSeconds,
                    score: progressObj.levelData.score,
                    stars: progressObj.levelData.stars,
                    game_mode: progressObj.levelData.gameMode,
                } : undefined,
            }),
        });

        const data = await response.json();
        if (data.success) {
            console.log("Progress saved to server:", data.data);
        } else {
            console.error("Failed to save progress:", data.message);
        }
    } catch (error) {
        console.error("Error saving progress:", error);
    }
}

// 获取关卡统计
async function getLevelStats(level) {
    if (!USER_ID || !jwtToken) {
        console.warn("No user ID or token, cannot get level stats");
        return null;
    }

    try {
        const url = level ? `/api/levels/stats?level=${level}` : '/api/levels/stats';
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
            },
        });

        const data = await response.json();
        if (data.success) {
            return data.data;
        } else {
            console.error("Failed to get level stats:", data.message);
            return null;
        }
    } catch (error) {
        console.error("Error getting level stats:", error);
        return null;
    }
}

// 导出函数
window.saveProgressWithMoves = saveProgressWithMoves;
window.getLevelStats = getLevelStats;
