const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { createLoader } = require('./helpers/load-ts.cjs');
const { backfillLevelBests } = require('../prisma/backfill-level-bests.cjs');

test('PostgreSQL: replay, account isolation, concurrent first clears, hint retries and achievement delivery', {
  skip: process.env.TOURMASTER_GAME_DB_TEST !== '1', timeout: 60000,
}, async (t) => {
  const { PrismaClient } = require('@prisma/client');
  const url = process.env.TOURMASTER_TEST_DATABASE_URL;
  assert.ok(url, 'An explicitly isolated test database URL is required');
  const schema = 'tourmaster_game_test_' + randomUUID().replaceAll('-', '');
  const admin = new PrismaClient({ datasources: { db: { url } } });
  const isolated = new URL(url);
  isolated.searchParams.set('schema', schema);
  const prisma = new PrismaClient({ datasources: { db: { url: isolated.toString() } } });
  const user = { user_id: 42, username: 'game-test' };
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    // Exercise the actual migration, then create the existing application's baseline tables.
    for (const name of ['20261109_verified_game_attempts', '20261124_achievement_notifications']) {
      const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations', name, 'migration.sql'), 'utf8');
      for (const statement of migration.split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
    }
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
      cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: isolated.toString() }, stdio: 'pipe',
    });
    const load = createLoader({ '@/lib/prisma': { prisma } });
    const { startAttempt, finishAttempt, useAttemptHint, transitionAttempt } = load('lib/game/attempts.ts');
    const { getFixedLevelConfig } = load('lib/game/levelCatalog.ts');
    await assert.rejects(startAttempt(user, 100, 'classic'), /LEVEL_LOCKED/);
    const attempt = await startAttempt(user, 1, 'classic');
    const hints = await Promise.all(Array.from({ length: 8 }, () => useAttemptHint(user, attempt.attempt_id, [])));
    assert.ok(hints.every(h => h.hint_count === 0));
    assert.equal(await prisma.attemptHint.count(), 1);
    await assert.rejects(useAttemptHint({ ...user, user_id: 43 }, attempt.attempt_id, []), /INVALID_ATTEMPT/);
    await assert.rejects(finishAttempt(user, attempt.attempt_id, []), /INVALID_SOLUTION/);
    await assert.rejects(finishAttempt(user, attempt.attempt_id, [{ r: 1000, c: 0 }]), /INVALID_SOLUTION/);

    const otherAttempt = await startAttempt(user, 1, 'classic');
    const solution = getFixedLevelConfig(1, 'classic').solution;
    const completed = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      finishAttempt(user, i % 2 ? attempt.attempt_id : otherAttempt.attempt_id, solution)));
    assert.ok(completed.every(r => r.total_levels === 2));
    const bests = await prisma.levelBest.findMany();
    assert.equal(bests.length, 1, 'one best result per account, mode and level');
    assert.equal(bests[0].clear_count, 2, 'separate clears are counted once even with retries');
    assert.equal(await prisma.levelRecord.count(), 0, 'successful attempts no longer append legacy records');
    let stock = await prisma.userHint.findUniqueOrThrow({ where: { portal_user_id: user.user_id } });
    assert.equal(stock.hint_count, 1, 'first clear reward is issued once across separate concurrent attempts');
    assert.equal(stock.undo_count, 2);
    const retry = await finishAttempt(user, attempt.attempt_id, solution);
    assert.equal(retry.hint_count, 1);
    await transitionAttempt(user, attempt.attempt_id, 'pause');
    assert.equal((await finishAttempt(user, attempt.attempt_id, solution)).hint_count, 1);
    await assert.rejects(transitionAttempt(user, attempt.attempt_id, 'resume'), /GAME_FINISHED/);

    const next = await startAttempt(user, 2, 'classic');
    await Promise.all(Array.from({ length: 4 }, () => transitionAttempt(user, next.attempt_id, 'pause')));
    let saved = await prisma.gameAttempt.findUniqueOrThrow({ where: { id: next.attempt_id } });
    const elapsed = saved.active_ms;
    assert.equal(saved.resumed_at, null);
    await transitionAttempt(user, next.attempt_id, 'pause');
    saved = await prisma.gameAttempt.findUniqueOrThrow({ where: { id: next.attempt_id } });
    assert.equal(saved.active_ms, elapsed);
    await transitionAttempt(user, next.attempt_id, 'resume');
    saved = await prisma.gameAttempt.findUniqueOrThrow({ where: { id: next.attempt_id } });
    assert.ok(saved.resumed_at instanceof Date);
    await assert.rejects(startAttempt(user, 3, 'classic'), /LEVEL_LOCKED/);
    stock = await prisma.userHint.findUniqueOrThrow({ where: { portal_user_id: user.user_id } });
    assert.equal(stock.hint_count, 1);

    const pending = await prisma.achievementNotification.findMany();
    assert.equal(pending.length, 1, 'concurrent attempts advance each achievement counter at most once');
    assert.equal(pending[0].clears, 1);
    assert.equal(pending[0].new_clear, true);
    assert.equal(pending[0].three_stars, 1);
    assert.equal(pending[0].new_three_stars, true);

    const secret = 'isolated-achievement-test-secret';
    const settings = {
      TOURMASTER_REWARD_SECRET: secret,
      TOURMASTER_SESSION_JWT_SECRET: secret,
      TOURMASTER_JWT_ALG: 'HS256',
      PORTAL_INTERNAL_API_URL: 'https://portal.example.test/',
    };
    for (const [key, value] of Object.entries(settings)) {
      const original = process.env[key];
      process.env[key] = value;
      t.after(() => {
        if (original === undefined) delete process.env[key];
        else process.env[key] = original;
      });
    }
    const { deliverAchievementNotifications } = load('lib/game/achievementNotifications.ts');
    const send = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
    await deliverAchievementNotifications(user.user_id);
    assert.equal(await prisma.achievementNotification.count(), 1);
    await deliverAchievementNotifications(user.user_id);
    assert.equal(send.mock.callCount(), 1, 'failed deliveries wait until the next retry is due');

    await prisma.achievementNotification.updateMany({ data: { next_attempt_at: new Date(0) } });
    send.mock.mockImplementation(async () => Response.json({
      success: true, data: { game_key: 'chess-tourmaster', accepted: [] },
    }));
    await deliverAchievementNotifications();
    const [url, options] = send.mock.calls[1].arguments;
    assert.equal(url, 'https://portal.example.test/api/games/chess-tourmaster/achievements/events');
    const claims = jwt.verify(options.headers.Authorization.slice(7), secret, {
      audience: 'chess-tourmaster-achievements', issuer: 'chess-tourmaster-game',
    });
    assert.equal(claims.purpose, 'achievement-progress');
    assert.equal(claims.user_id, String(user.user_id));
    assert.equal(claims.mode, 'classic');
    assert.equal(claims.clears, pending[0].clears);
    assert.equal(claims.three_stars, pending[0].three_stars);
    assert.equal(await prisma.achievementNotification.count(), 0);

    await t.test('official levels alone count toward stats and achievement milestones', async () => {
      const { NextRequest } = require('next/server');
      const { MAX_LEVELS } = load('lib/game/rules.ts');
      const { issueSessionToken, SESSION_COOKIE_NAME } = load('lib/auth.ts');
      const { GET } = load('app/api/levels/stats/route.ts');
      const player = { user_id: 44, username: 'official-levels-test' };
      const record = { portal_user_id: player.user_id, username: player.username, game_mode: 'classic',
        moves_count: 24, time_seconds: 20 };
      await prisma.levelRecord.createMany({ data: [
        ...Array.from({ length: 8 }, (_, index) => ({ ...record, level: index + 1, stars: index < 2 ? 3 : 1,
          completed_at: new Date('2025-01-01T00:00:00Z') })),
        { ...record, level: 3, stars: 3, time_seconds: 30, moves_count: 23, completed_at: new Date('2025-01-02T00:00:00Z') },
        { ...record, level: MAX_LEVELS + 1, stars: 3 },
      ] });
      assert.equal(await backfillLevelBests(prisma), 8);
      assert.equal(await backfillLevelBests(prisma), 0);
      const level3Key = { portal_user_id_game_mode_level: { portal_user_id: player.user_id, game_mode: 'classic', level: 3 } };
      const level3 = await prisma.levelBest.findUniqueOrThrow({ where: level3Key });
      assert.equal(level3.best_stars, 3);
      assert.equal(level3.best_time_seconds, 20);
      assert.equal(level3.best_moves, 23);
      assert.equal(level3.clear_count, 2);
      assert.equal(level3.first_cleared_at.toISOString(), '2025-01-01T00:00:00.000Z');
      const ninth = await startAttempt(player, 9, 'classic');
      await transitionAttempt(player, ninth.attempt_id, 'pause');
      const ninthSolution = getFixedLevelConfig(9, 'classic').solution;
      assert.equal((await finishAttempt(player, ninth.attempt_id, ninthSolution)).stars, 3);

      const token = issueSessionToken({ ...player, sub: player.username });
      const readStats = async (query = '') => {
        const response = await GET(new NextRequest(`http://localhost/api/levels/stats?game_mode=classic${query}`, {
          headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
        }));
        assert.equal(response.status, 200);
        return (await response.json()).data;
      };
      const overview = await readStats();
      assert.deepEqual(overview.levels.map(entry => entry.level), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.equal(overview.total_attempts, 10);
      assert.equal(overview.levels[2].attempts, 2);
      assert.equal(overview.levels[2].best_stars, 3);
      assert.equal(overview.levels.filter(entry => entry.best_stars === 3).length, 4);
      assert.deepEqual((await readStats(`&level=${MAX_LEVELS + 1}`)).records, []);
      assert.equal((await readStats('&level=9')).records[0].id, ninth.attempt_id);

      const previousCalls = send.mock.callCount();
      await deliverAchievementNotifications(player.user_id);
      const tenth = await startAttempt(player, 10, 'classic');
      await transitionAttempt(player, tenth.attempt_id, 'pause');
      const tenthSolution = getFixedLevelConfig(10, 'classic').solution;
      await finishAttempt(player, tenth.attempt_id, tenthSolution);
      await finishAttempt(player, tenth.attempt_id, tenthSolution);
      assert.equal((await readStats()).levels.length, 10);
      await deliverAchievementNotifications(player.user_id);
      await deliverAchievementNotifications(player.user_id);

      const events = send.mock.calls.slice(previousCalls).map(({ arguments: [, options] }) => {
        const event = jwt.verify(options.headers.Authorization.slice(7), secret, {
          audience: 'chess-tourmaster-achievements', issuer: 'chess-tourmaster-game',
        });
        return [event.clears, event.three_stars, event.new_clear, event.new_three_stars];
      });
      assert.deepEqual(events, [[9, 4, true, true], [10, 5, true, true]],
        'only the tenth official clear sends progress reaching the 10-clear and 5-three-star milestones');
      assert.equal(await prisma.achievementNotification.count(), 0);

      const replay = await startAttempt(player, 3, 'classic');
      await prisma.gameAttempt.update({ where: { id: replay.attempt_id }, data: { resumed_at: null, active_ms: 0 } });
      await finishAttempt(player, replay.attempt_id, getFixedLevelConfig(3, 'classic').solution);
      assert.equal(await backfillLevelBests(prisma), 0);
      const afterReplay = await prisma.levelBest.findUniqueOrThrow({ where: level3Key });
      assert.equal(afterReplay.first_cleared_at.getTime(), level3.first_cleared_at.getTime());
      assert.equal(afterReplay.best_stars, 3);
      assert.equal(afterReplay.best_time_seconds, 0);
      assert.equal(afterReplay.clear_count, 3);
      const details = await readStats('&level=3');
      assert.equal(details.best_time, 0);
      assert.equal(details.records.length, 3);
      assert.equal(details.records[0].id, replay.attempt_id);
      assert.equal(await prisma.achievementNotification.count(), 0);

      const improvement = await startAttempt(player, 4, 'classic');
      await prisma.gameAttempt.update({ where: { id: improvement.attempt_id }, data: { resumed_at: null, active_ms: 0 } });
      const fourthSolution = getFixedLevelConfig(4, 'classic').solution;
      await finishAttempt(player, improvement.attempt_id, fourthSolution);
      const slower = await startAttempt(player, 4, 'classic');
      await prisma.gameAttempt.update({ where: { id: slower.attempt_id }, data: { resumed_at: null, active_ms: 1_000_000 } });
      assert.equal((await finishAttempt(player, slower.attempt_id, fourthSolution)).stars, 1);
      const level4 = (await readStats()).levels.find(entry => entry.level === 4);
      assert.equal(level4.best_stars, 3);
      assert.equal(level4.best_time, 0);
      assert.equal(level4.attempts, 3);
      const promotion = await prisma.achievementNotification.findMany();
      assert.equal(promotion.length, 1);
      assert.equal(promotion[0].clears, 10);
      assert.equal(promotion[0].three_stars, 6);
      assert.equal(promotion[0].new_clear, false);
      assert.equal(promotion[0].new_three_stars, true);
    });

    await t.test('Math Tour persists score boundaries and reports a first three-star result once', async () => {
      const { replayGame } = load('lib/game/replay.ts');
      const player = { user_id: 45, username: 'math-stars-test' };
      const mode = 'math_tour';
      const level = 1;
      const bestKey = { portal_user_id_game_mode_level: { portal_user_id: player.user_id, game_mode: mode, level } };
      const routes = {
        27: [[0, 1], [2, 2], [0, 3], [1, 1], [2, 3], [3, 1], [1, 2], [0, 4]],
        28: [[0, 1], [1, 3], [3, 4], [2, 2], [1, 4], [0, 2], [2, 3], [0, 4]],
        31: [[0, 1], [1, 3], [3, 2], [1, 1], [0, 3], [2, 2], [1, 0], [0, 2], [2, 3], [0, 4]],
        35: [[0, 1], [2, 2], [0, 3], [1, 1], [3, 2], [4, 4], [2, 3], [3, 1], [1, 2], [0, 4]],
      };
      const movesFor = (score) => routes[score].map(([r, c]) => ({ r, c }));
      for (const score of [27, 28, 31, 35]) {
        const beforeKing = replayGame(level, mode, movesFor(score).slice(0, -1), false);
        assert.equal(beforeKing.currentScore, score);
      }

      const invalid = await startAttempt(player, level, mode);
      await assert.rejects(finishAttempt(player, invalid.attempt_id, movesFor(27)), /INVALID_SOLUTION/);
      const unfinished = await prisma.gameAttempt.findUniqueOrThrow({ where: { id: invalid.attempt_id } });
      assert.equal(unfinished.finished_at, null);
      assert.equal(unfinished.stars, null);
      assert.equal(await prisma.levelBest.findUnique({ where: bestKey }), null);

      const events = () => prisma.achievementNotification.findMany({
        where: { portal_user_id: player.user_id, game_mode: mode },
        orderBy: { three_stars: 'asc' },
        select: { attempt_id: true, clears: true, three_stars: true, new_clear: true, new_three_stars: true },
      });
      assert.deepEqual(await events(), []);

      async function clearWithScore(score, stars, bestStars) {
        const attempt = await startAttempt(player, level, mode);
        const result = await finishAttempt(player, attempt.attempt_id, movesFor(score));
        assert.equal(result.stars, stars);
        assert.equal((await prisma.gameAttempt.findUniqueOrThrow({ where: { id: attempt.attempt_id } })).stars, stars);
        assert.equal((await prisma.levelBest.findUniqueOrThrow({ where: bestKey })).best_stars, bestStars);
        return attempt.attempt_id;
      }

      const firstClear = await clearWithScore(28, 1, 1);
      await clearWithScore(31, 2, 2);
      const clearEvent = { attempt_id: firstClear, clears: 1, three_stars: 0, new_clear: true, new_three_stars: false };
      assert.deepEqual(await events(), [clearEvent]);

      const firstThreeStars = await clearWithScore(35, 3, 3);
      assert.equal((await finishAttempt(player, firstThreeStars, movesFor(35))).stars, 3);
      await clearWithScore(28, 1, 3);
      await clearWithScore(35, 3, 3);
      assert.equal((await prisma.levelBest.findUniqueOrThrow({ where: bestKey })).clear_count, 5);
      assert.deepEqual(await events(), [
        clearEvent,
        { attempt_id: firstThreeStars, clears: 1, three_stars: 1, new_clear: false, new_three_stars: true },
      ]);
    });
  } finally {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.$disconnect();
  }
});
