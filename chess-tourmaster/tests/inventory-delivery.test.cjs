const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const secret = 'isolated-tourmaster-inventory-secret';
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env: { TOURMASTER_JWT_SECRET: secret } },
    require: name => dependencies[name] ?? require(name) });
  return exports;
}
const sign = (overrides = {}, signingSecret = secret) => jwt.sign({ user_id: 42,
  game_key: 'chess-tourmaster', purpose: 'chess-tourmaster-inventory', purchase_id: randomUUID(),
  grants: { chess_tourmaster_hint: 3, chess_tourmaster_undo: 2 },
  aud: 'chess-tourmaster', iss: 'main-portal', exp: Math.floor(Date.now() / 1000) + 300, ...overrides }, signingSecret);

test('Tourmaster inventory receipts reject login tokens, another account/game, tampering and invalid grants', () => {
  const { verifyInventoryReceipt } = load('lib/inventory-receipt.ts');
  assert.equal(verifyInventoryReceipt(sign(), 42).grants.chess_tourmaster_hint, 3);
  for (const token of [sign({}, 'wrong-secret'), sign({ user_id: 43 }), sign({ purpose: undefined }),
    sign({ game_key: 'chessmater' }), sign({ aud: 'chessmater' }), sign({ grants: { chess_mater_reply: 3 } }),
    sign({ grants: { chess_tourmaster_hint: -1 } }), sign({ grants: {} }), sign({ exp: 1 }), sign({ purchase_id: 'invalid' })]) {
    assert.equal(verifyInventoryReceipt(token, 42), null);
  }
});

test('Prisma delivery is atomic and idempotent, while Hint/Undo consumption stays in the Tourmaster database', {
  skip: process.env.TOURMASTER_INVENTORY_DB_TEST !== '1'
}, async () => {
  const { PrismaClient } = require('@prisma/client');
  const url = process.env.TOURMASTER_TEST_DATABASE_URL;
  assert.ok(url, 'Supply an explicit local test database URL');
  const schema = 'tourmaster_inventory_test_' + randomUUID().replaceAll('-', '');
  const admin = new PrismaClient({ datasources: { db: { url } } });
  const isolated = new URL(url); isolated.searchParams.set('schema', schema);
  const prisma = new PrismaClient({ datasources: { db: { url: isolated.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    await prisma.$executeRawUnsafe(`CREATE TABLE user_hints (
      id SERIAL PRIMARY KEY, portal_user_id INTEGER UNIQUE NOT NULL, username TEXT NOT NULL,
      hint_count INTEGER NOT NULL DEFAULT 1, undo_count INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const local = load('lib/userHint.ts', { '@/lib/prisma': { prisma } });
    const { applyInventoryReceipt } = load('lib/inventory.ts', { '@/lib/prisma': { prisma }, '@/lib/userHint': local });
    const { verifyInventoryReceipt } = load('lib/inventory-receipt.ts');
    const receipt = verifyInventoryReceipt(sign(), 42);
    await Promise.all(Array.from({ length: 8 }, () => applyInventoryReceipt(receipt, 'test')));
    let balance = await local.ensureUserHint(42, 'test');
    assert.equal(balance.hint_count, 4); assert.equal(balance.undo_count, 3);
    assert.equal((await prisma.$queryRawUnsafe('SELECT * FROM inventory_deliveries')).length, 1);
    await assert.rejects(applyInventoryReceipt({ ...receipt, grants: { chess_tourmaster_hint: 10 } }, 'test'), /mismatch/);
    const hints = await Promise.all(Array.from({ length: 12 }, () => local.consumeHintCount(42, 'test')));
    assert.equal(hints.filter(result => result.success).length, 4);
    const undos = await Promise.all(Array.from({ length: 12 }, () => local.consumeUndoCount(42, 'test')));
    assert.equal(undos.filter(result => result.success).length, 3);
    balance = await local.ensureUserHint(42, 'test');
    assert.equal(balance.hint_count, 0); assert.equal(balance.undo_count, 0);
    await applyInventoryReceipt(receipt, 'test');
    assert.equal((await local.ensureUserHint(42, 'test')).hint_count, 0);
    const overflow = { ...receipt, purchase_id: randomUUID(), grants: { chess_tourmaster_undo: 1000000000 } };
    await prisma.userHint.update({ where: { portal_user_id: 42 }, data: { undo_count: 2000000000 } });
    await assert.rejects(applyInventoryReceipt(overflow, 'test'));
    assert.equal((await prisma.$queryRawUnsafe('SELECT * FROM inventory_deliveries')).length, 1);
    await prisma.userHint.update({ where: { portal_user_id: 42 }, data: { undo_count: 0 } });
    assert.equal((await applyInventoryReceipt(overflow, 'test')).undo_count, 1000000000);
  } finally {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.$disconnect();
  }
});
