const { MAX_LEVELS } = require('../lib/game/rules.ts');

async function backfillLevelBests(prisma) {
  return prisma.$executeRaw`
    INSERT INTO level_bests (
      portal_user_id, game_mode, level, best_stars, best_time_seconds, best_moves, first_cleared_at, clear_count
    )
    SELECT portal_user_id, game_mode, level, MAX(stars), MIN(time_seconds), MIN(moves_count),
      MIN(completed_at), COUNT(*)::integer
    FROM level_records
    WHERE game_mode IN ('classic', 'math_tour') AND level BETWEEN 1 AND ${MAX_LEVELS}
    GROUP BY portal_user_id, game_mode, level
    ON CONFLICT (portal_user_id, game_mode, level) DO NOTHING
  `;
}

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  backfillLevelBests(prisma)
    .then(count => console.log(`Backfilled ${count} level bests.`))
    .catch(error => {
      console.error('Level bests backfill failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { backfillLevelBests };
