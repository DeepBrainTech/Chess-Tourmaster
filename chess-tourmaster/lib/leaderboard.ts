import { prisma } from '@/lib/prisma';

type LeaderboardRow = {
  portal_user_id: number;
  username: string;
  total_levels: bigint | number;
  rank: bigint | number;
  updated_at: Date;
};

export async function loadLeaderboard(mode: string | null, limit: number, currentUserId: number | null) {
  const rows = await prisma.$queryRaw<LeaderboardRow[]>`
    WITH sources AS (
      SELECT portal_user_id, game_mode,
        COUNT(DISTINCT level)::bigint AS total_levels, MAX(completed_at) AS updated_at
      FROM level_records
      WHERE portal_user_id > 0 AND (${mode}::text IS NULL OR game_mode = ${mode})
      GROUP BY portal_user_id, game_mode
      UNION ALL
      SELECT portal_user_id, game_mode,
        GREATEST(LEAST(max_unlocked_level, 100) - 1, 0)::bigint AS total_levels, updated_at
      FROM mode_progress
      WHERE portal_user_id > 0 AND (${mode}::text IS NULL OR game_mode = ${mode})
    ), mode_scores AS (
      SELECT portal_user_id, game_mode, MAX(total_levels) AS total_levels, MAX(updated_at) AS updated_at
      FROM sources
      GROUP BY portal_user_id, game_mode
    ), scores AS (
      SELECT portal_user_id, SUM(total_levels)::bigint AS total_levels, MAX(updated_at) AS updated_at
      FROM mode_scores
      GROUP BY portal_user_id
      HAVING SUM(total_levels) > 0
    ), names AS (
      SELECT DISTINCT ON (portal_user_id) portal_user_id, username
      FROM (
        SELECT portal_user_id, username, updated_at, 3 AS priority FROM user_hints
        UNION ALL
        SELECT portal_user_id, username, updated_at, 2 AS priority FROM mode_progress
        UNION ALL
        SELECT portal_user_id, username, completed_at AS updated_at, 1 AS priority FROM level_records
      ) candidates
      ORDER BY portal_user_id, priority DESC, updated_at DESC, username ASC
    ), ranked AS (
      SELECT scores.*, names.username,
        ROW_NUMBER() OVER (ORDER BY total_levels DESC, updated_at ASC, scores.portal_user_id ASC) AS rank
      FROM scores JOIN names USING (portal_user_id)
    )
    SELECT * FROM ranked
    WHERE rank <= ${limit} OR portal_user_id = ${currentUserId}::integer
    ORDER BY rank ASC
  `;
  return rows.map(entry => ({ ...entry,
    total_levels: Number(entry.total_levels), rank: Number(entry.rank),
  }));
}
