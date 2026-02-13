/**
 * 游戏 API 客户端
 * 处理所有与后端的交互
 */

export interface GameProgress {
  high_score: number;
  total_levels?: number;
}

export interface LeaderboardEntry {
  rank: number;
  portal_user_id: number;
  username: string;
  high_score: number;
  total_levels: number;
  updated_at: string;
}

export class GameAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * 保存游戏进度到服务器
   */
  async saveProgress(highScore: number, totalLevels?: number): Promise<boolean> {
    try {
      const response = await fetch('/api/progress/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          high_score: highScore,
          total_levels: totalLevels,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to save progress:', data);
        return false;
      }

      return data.success;
    } catch (error) {
      console.error('Error saving progress:', error);
      return false;
    }
  }

  /**
   * 从服务器加载游戏进度
   */
  async loadProgress(): Promise<GameProgress | null> {
    try {
      const response = await fetch('/api/progress/load', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to load progress:', data);
        return null;
      }

      if (!data.success) {
        return null;
      }

      return {
        high_score: data.data.high_score,
        total_levels: data.data.total_levels,
      };
    } catch (error) {
      console.error('Error loading progress:', error);
      return null;
    }
  }

  /**
   * 获取排行榜
   */
  static async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(`/api/leaderboard?limit=${limit}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        console.error('Failed to load leaderboard:', data);
        return [];
      }

      return data.data;
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      return [];
    }
  }
}
