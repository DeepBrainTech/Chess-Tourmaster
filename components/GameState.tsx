/**
 * 游戏状态管理
 * 这个文件定义游戏相关的类型和接口
 */

// 游戏进度数据类型
export interface GameProgress {
  highScore: number;
  totalLevels?: number;
  bestMoves?: number;
  totalMoves?: number;
}

// 关卡数据类型
export interface LevelData {
  level: number;
  movesCount: number;
  timeSeconds: number;
  score: number;
  stars: number;
  gameMode: 'classic' | 'math_tour';
}

// 排行榜条目类型
export interface LeaderboardEntry {
  rank: number;
  portal_user_id: number;
  username: string;
  high_score: number;
  total_levels: number;
  updated_at: string;
}

// 关卡统计类型
export interface LevelStats {
  level: number;
  records: any[];
  best_moves: number | null;
  best_time: number | null;
  attempts: number;
}
