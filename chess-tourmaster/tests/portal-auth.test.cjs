const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jwt = require('jsonwebtoken');
const source = fs.readFileSync(path.join(__dirname, '../lib/auth.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
}}).outputText;
const secret = 'isolated-tourmaster-test-secret';
const claims = { user_id: 42, username: 'commerce-test', sub: 'commerce-test',
  exp: Math.floor(Date.now() / 1000) + 300, aud: 'chess-tourmaster', iss: 'main-portal' };
function verifier(env = { TOURMASTER_JWT_SECRET: secret }) {
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env }, console: { error() {} },
    require: name => {
      if (name === 'jsonwebtoken') return jwt;
      if (name === '@/lib/http') return { jsonResponse: body => body };
      if (name === 'next/server') return {};
      throw new Error(name);
    } });
  return exports.verifyToken;
}
test('Tourmaster accepts the portal login contract', () => {
  assert.equal(verifier()(jwt.sign(claims, secret)).user_id, 42);
});
test('Tourmaster rejects incorrect audiences, issuers, signatures, identity and paid grants', () => {
  for (const change of [{ aud: 'chessmater' }, { iss: 'wrong-issuer' }, { user_id: '42' },
    { exp: undefined }, { username: undefined }, { purpose: 'level-replay' }, { exp: 1 }]) {
    assert.equal(verifier()(jwt.sign(Object.fromEntries(Object.entries({ ...claims, ...change }).filter(([, value]) => value !== undefined)), secret)), null);
  }
  assert.equal(verifier()(jwt.sign(claims, 'wrong-secret')), null);
});
test('Tourmaster does not accept the old generic JWT_SECRET configuration', () => {
  assert.equal(verifier({ JWT_SECRET: secret })(jwt.sign(claims, secret)), null);
});
