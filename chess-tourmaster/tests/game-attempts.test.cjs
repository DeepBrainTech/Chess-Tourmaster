const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createLoader } = require('./helpers/load-ts.cjs');
const user = { user_id: 42, username: 'audit-test' };

function fixture() {
  const id = randomUUID();
  let balance = { hint_count: 3, undo_count: 1 };
  let attempt = { id, portal_user_id: 42, game_mode: 'classic', level: 1, level_version: 2,
    started_at: new Date(Date.now() - 100000), resumed_at: null, active_ms: 100000, finished_at: null, stars: null };
  let progress = { max_unlocked_level: 1 };
  const records = [], hints = new Map(), events = [];
  const tx = {
    userHint: {
      upsert: async () => balance,
      update: async ({ data }) => {
        events.push('account-lock');
        for (const field of ['hint_count', 'undo_count']) {
          if (data[field]?.increment) balance[field] += data[field].increment;
          if (data[field]?.decrement) balance[field] -= data[field].decrement;
        }
        return { ...balance };
      },
      findUniqueOrThrow: async () => ({ ...balance }),
    },
    gameAttempt: {
      findFirst: async ({ where }) => where.id === attempt.id && where.portal_user_id === attempt.portal_user_id ? { ...attempt } : null,
      create: async ({ data }) => { attempt = { ...attempt, ...data }; return attempt; },
      update: async ({ data }) => { attempt = { ...attempt, ...data }; return attempt; },
    },
    modeProgress: { findUnique: async () => { events.push('read-progress'); return progress; },
      upsert: async ({ update }) => { progress = update; } },
    levelRecord: { aggregate: async () => ({ _max: { level: null } }), findFirst: async () => records[0] ?? null,
      create: async ({ data }) => { records.push(data); return data; } },
    attemptHint: { findUnique: async ({ where }) => hints.get(where.attempt_id_position_key.position_key) ?? null,
      create: async ({ data }) => { hints.set(data.position_key, data); } },
  };
  const prisma = { ...tx, $transaction: async fn => fn(tx) };
  const load = createLoader({ '@/lib/prisma': { prisma } });
  return { api: load('lib/game/attempts.ts'), load, id, records, hints, events,
    setAttempt: data => { attempt = { ...attempt, ...data }; }, get balance() { return balance; } };
}

test('start rejects out-of-range, fractional, unknown-mode and locked levels before issuing an attempt', async () => {
  const f = fixture();
  for (const [level, mode] of [[0, 'classic'], [1000, 'classic'], [1.5, 'classic'], [1, 'unknown'], [2, 'classic']]) {
    await assert.rejects(f.api.startAttempt(user, level, mode), /INVALID_LEVEL|LEVEL_LOCKED/);
  }
  const started = await f.api.startAttempt(user, 1, 'classic');
  assert.equal(started.attempt_id, f.id);
  assert.ok(f.events.indexOf('account-lock') < f.events.indexOf('read-progress'));
});

test('save rejects absent, foreign, expired and outdated attempts and forged or incomplete move paths', async () => {
  const f = fixture();
  await assert.rejects(f.api.finishAttempt(user, undefined, []), /INVALID_ATTEMPT/);
  await assert.rejects(f.api.finishAttempt({ ...user, user_id: 43 }, f.id, []), /INVALID_ATTEMPT/);
  for (const moves of [[], [{ r: 999, c: 0 }], null, Array(50).fill({ r: 0, c: 0 })]) {
    await assert.rejects(f.api.finishAttempt(user, f.id, moves), /INVALID_SOLUTION/);
  }
  f.setAttempt({ started_at: new Date(0) });
  await assert.rejects(f.api.finishAttempt(user, f.id, []), /ATTEMPT_EXPIRED/);
  f.setAttempt({ started_at: new Date(), level_version: 1 });
  await assert.rejects(f.api.finishAttempt(user, f.id, []), /INVALID_ATTEMPT/);
  assert.equal(f.records.length, 0);
  assert.equal(f.balance.hint_count, 3);
});

test('server derives time, stars, moves and unlocks from its attempt and replay; retry gives no duplicate reward', async () => {
  const f = fixture();
  const solution = f.load('lib/game/levelCatalog.ts').getFixedLevelConfig(1, 'classic').solution;
  const saved = await f.api.finishAttempt(user, f.id, solution);
  assert.equal(saved.stars, 1);
  assert.equal(saved.time_seconds, 100);
  assert.equal(saved.total_levels, 2);
  assert.equal(f.records[0].moves_count, solution.length);
  assert.equal(f.balance.hint_count, 4);
  assert.equal(f.balance.undo_count, 2);
  await f.api.transitionAttempt(user, f.id, 'pause');
  assert.deepEqual(await f.api.finishAttempt(user, f.id, solution), saved);
  assert.equal(f.records.length, 1);
  assert.equal(f.balance.hint_count, 4);
});

test('hint is tied to a legal position and charged once across retries; impossible search costs nothing', async () => {
  const f = fixture();
  const first = await f.api.useAttemptHint(user, f.id, []);
  const again = await f.api.useAttemptHint(user, f.id, []);
  assert.deepEqual(again, first);
  assert.equal(first.hint_count, 2);
  assert.equal(f.hints.size, 1);
  await assert.rejects(f.api.useAttemptHint(user, f.id, [{ r: -1, c: -1 }]), /INVALID_MOVES/);
  assert.equal(f.balance.hint_count, 2);
  const { gameReducer, initialGameState } = f.load('lib/game/gameReducer.ts');
  const { getFixedLevelConfig } = f.load('lib/game/levelCatalog.ts');
  const { getValidMoves } = f.load('lib/game/moves.ts');
  const { getHintMove } = f.load('lib/game/hint.ts');
  let deadPath;
  function findDead(state) {
    if (!state.isPlaying) return;
    if (getHintMove(state).type === 'no_win_path') { deadPath = state.history.map(e => e.prevPos); return; }
    for (const p of getValidMoves(state.knightPos.r, state.knightPos.c, state.gridSizeVal)) {
      const next = gameReducer(state, { type: 'MOVE', payload: p });
      if (next !== state && !deadPath) findDead(next);
    }
  }
  for (let level = 1; level <= 12 && !deadPath; level++) {
    f.setAttempt({ level });
    findDead(gameReducer(initialGameState, { type: 'START_LEVEL', payload: getFixedLevelConfig(level, 'classic') }));
  }
  assert.ok(deadPath, 'fixture must exercise a legal dead-end rather than skip the assertion');
  await assert.rejects(f.api.useAttemptHint(user, f.id, deadPath), /NO_WIN_PATH/);
  assert.equal(f.balance.hint_count, 2);
});

test('pause and resume are idempotent and reject invalid transitions', async () => {
  const f = fixture();
  await f.api.transitionAttempt(user, f.id, 'pause');
  await f.api.transitionAttempt(user, f.id, 'pause');
  await f.api.transitionAttempt(user, f.id, 'resume');
  await f.api.transitionAttempt(user, f.id, 'resume');
  await assert.rejects(f.api.transitionAttempt(user, f.id, 'unknown'), /INVALID_ACTION/);
  f.setAttempt({ finished_at: new Date() });
  await assert.rejects(f.api.transitionAttempt(user, f.id, 'resume'), /GAME_FINISHED/);
});
