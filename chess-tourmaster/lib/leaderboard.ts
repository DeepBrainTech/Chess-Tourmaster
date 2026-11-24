import { prisma } from '@/lib/prisma';
import { MAX_LEVELS } from './game/rules';

type LeaderboardRow = {
  portal_user_id: number;
  username: string;
  total_levels: bigint | number;
  rank: bigint | number;
  updated_at: Date;
};

export async function loadLeaderboard(mode: string | null, limit: number, currentUserId: number | null, offset = 0) {
  const rows = await prisma.$queryRaw<LeaderboardRow[]>`
    WITH scores AS (
      SELECT portal_user_id, COUNT(*) AS total_levels, MAX(first_cleared_at) AS updated_at
      FROM level_bests
      WHERE portal_user_id > 0 AND game_mode IN ('classic', 'math_tour')
        AND level BETWEEN 1 AND ${MAX_LEVELS}
        AND (${mode}::text IS NULL OR game_mode = ${mode})
      GROUP BY portal_user_id
    ), ranked AS (
      SELECT scores.*, ROW_NUMBER() OVER (ORDER BY total_levels DESC, updated_at ASC, portal_user_id ASC) AS rank
      FROM scores
    ), selected AS (
      SELECT * FROM ranked
      WHERE (rank > ${offset} AND rank <= ${offset + limit}) OR portal_user_id = ${currentUserId}::integer
    )
    SELECT selected.*, COALESCE(hints.username, latest.username) AS username
    FROM selected
    LEFT JOIN user_hints hints USING (portal_user_id)
    LEFT JOIN LATERAL (
      SELECT username FROM level_records
      WHERE portal_user_id = selected.portal_user_id AND hints.username IS NULL
      ORDER BY completed_at DESC, username ASC
      LIMIT 1
    ) latest ON true
    ORDER BY selected.rank ASC
  `;
  return rows.map(entry => ({ ...entry,
    total_levels: Number(entry.total_levels), rank: Number(entry.rank),
  }));
}
