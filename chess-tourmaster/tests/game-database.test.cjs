const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createLoader } = require('./helpers/load-ts.cjs');

test('PostgreSQL: replay, account isolation, concurrent first clears, hint retries and lost-response recovery', {
  skip: process.env.TOURMASTER_GAME_DB_TEST !== '1', timeout: 60000,
}, async () => {
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
    const migration = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261109_verified_game_attempts/migration.sql'), 'utf8');
    for (const statement of migration.split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(statement);
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
    assert.equal(await prisma.levelRecord.count(), 2, 'one record per actual attempt, even with retries');
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
  } finally {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.$disconnect();
  }
});
