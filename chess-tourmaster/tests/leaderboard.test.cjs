const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { backfillLevelBests } = require('../prisma/backfill-level-bests.cjs');

test('leaderboard ranks distinct clears, keeps global ranks across pages and returns the viewer', {
  skip: process.env.TOURMASTER_LEADERBOARD_DB_TEST !== '1',
}, async () => {
  const { PrismaClient } = require('@prisma/client');
  const url = process.env.TOURMASTER_TEST_DATABASE_URL;
  assert.ok(url, 'Supply an explicit local test database URL');
  const schema = 'tourmaster_leaderboard_test_' + randomUUID().replaceAll('-', '');
  const admin = new PrismaClient({ datasources: { db: { url } } });
  const isolated = new URL(url);
  isolated.searchParams.set('schema', schema);
  const prisma = new PrismaClient({ datasources: { db: { url: isolated.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    await prisma.$executeRawUnsafe(`CREATE TABLE level_records (
      portal_user_id INTEGER, username TEXT, game_mode TEXT, level INTEGER,
      stars INTEGER NOT NULL DEFAULT 1, time_seconds INTEGER NOT NULL DEFAULT 20, moves_count INTEGER NOT NULL DEFAULT 24,
      completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE level_bests (
      portal_user_id INTEGER, game_mode TEXT, level INTEGER, best_stars INTEGER, best_time_seconds INTEGER,
      best_moves INTEGER, first_cleared_at TIMESTAMP, clear_count INTEGER,
      PRIMARY KEY (portal_user_id, game_mode, level))`);
    await prisma.$executeRawUnsafe(`CREATE TABLE mode_progress (
      portal_user_id INTEGER, username TEXT, game_mode TEXT, max_unlocked_level INTEGER,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await prisma.$executeRawUnsafe(`CREATE TABLE user_hints (
      portal_user_id INTEGER, username TEXT, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await prisma.$executeRawUnsafe(`INSERT INTO mode_progress (portal_user_id, username, game_mode, max_unlocked_level)
      VALUES (42, 'old-name', 'classic', 11), (42, 'old-name', 'math_tour', 6),
        (43, 'legacy-progress-only', 'classic', 12), (44, 'not-started', 'classic', 1),
        (0, 'DevUser', 'classic', 100)`);
    await prisma.$executeRawUnsafe(`INSERT INTO level_records (portal_user_id, username, game_mode, level)
      VALUES (42, 'first-name', 'classic', 1), (42, 'second-name', 'classic', 2),
        (45, 'old-name', 'classic', 1), (45, 'new-name', 'classic', 1),
        (45, 'new-name', 'classic', 2), (45, 'new-name', 'math_tour', 1),
        (42, 'current-name', 'math_tour', 1), (42, 'current-name', 'math_tour', 2),
        (42, 'current-name', 'classic', 101), (0, 'DevUser', 'classic', 1)`);
    await prisma.$executeRawUnsafe(`UPDATE level_records SET completed_at = '2025-01-01' WHERE portal_user_id = 42`);
    await prisma.$executeRawUnsafe(`INSERT INTO level_records (portal_user_id, username, game_mode, level)
      VALUES (42, 'current-name', 'classic', 1)`);
    await prisma.$executeRawUnsafe(`INSERT INTO user_hints (portal_user_id, username)
      VALUES (42, 'current-name'), (45, 'current-name')`);
    await prisma.$executeRawUnsafe(`INSERT INTO level_records (portal_user_id, username, game_mode, level)
      SELECT n, 'leader-' || n, 'classic', level FROM generate_series(1, 11) n
      CROSS JOIN LATERAL generate_series(1, 20 + n) level`);
    await backfillLevelBests(prisma);

    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/leaderboard.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: name => {
      if (name === './game/rules') return { MAX_LEVELS: 100 };
      assert.equal(name, '@/lib/prisma');
      return { prisma };
    } });
    const { loadLeaderboard } = exports;
    const all = await loadLeaderboard('classic', 100, null);
    assert.equal(all.find(row => row.portal_user_id === 42).total_levels, 2);
    assert.equal(all.find(row => row.portal_user_id === 42).username, 'current-name');
    assert.equal(all.filter(row => row.portal_user_id === 42).length, 1);
    assert.equal(all.find(row => row.portal_user_id === 45).total_levels, 2);
    assert.equal(all.some(row => [0, 43, 44].includes(row.portal_user_id)), false);

    const visible = await loadLeaderboard('classic', 10, 42);
    assert.equal(visible.length, 11);
    assert.equal(visible.at(-1).portal_user_id, 42);
    assert.equal(visible.at(-1).rank, 12);
    const publicTop = await loadLeaderboard('classic', 10, null);
    assert.equal(publicTop.length, 10);
    assert.equal(publicTop.some(row => row.portal_user_id === 42), false);
    const secondPage = await loadLeaderboard('classic', 10, 42, 10);
    assert.equal(Array.from(secondPage, row => row.rank).join(','), '11,12,13');
    assert.equal(secondPage.filter(row => row.portal_user_id === 42).length, 1);

    const math = await loadLeaderboard('math_tour', 10, 42);
    assert.equal(math.find(row => row.portal_user_id === 42).total_levels, 2);
    assert.equal(math.find(row => row.portal_user_id === 42).rank, 1);
    const combined = await loadLeaderboard(null, 100, null);
    assert.equal(combined.find(row => row.portal_user_id === 42).total_levels, 4);
    assert.equal(combined.find(row => row.portal_user_id === 45).total_levels, 3);
  } finally {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.$disconnect();
  }
});
