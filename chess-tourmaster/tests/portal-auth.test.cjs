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
function loadAuth(env = { TOURMASTER_JWT_SECRET: secret }) {
  const exports = {};
  vm.runInNewContext(code, { exports, process: { env }, console: { error() {} },
    require: name => {
      if (name === 'jsonwebtoken') return jwt;
      if (name === '@/lib/http') return { jsonResponse: body => body };
      if (name === 'next/server') return {};
      throw new Error(name);
    } });
  return exports;
}
const verifier = env => loadAuth(env).verifyToken;
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

test('game sessions and portal login tokens cannot substitute for one another', () => {
  const auth = loadAuth();
  const session = auth.issueSessionToken(claims);
  assert.equal(auth.verifySessionToken(session).user_id, 42);
  assert.equal(auth.verifyToken(session), null);
  assert.equal(auth.verifySessionToken(jwt.sign(claims, secret)), null);
  assert.equal(auth.verifySessionToken(session + 'tampered'), null);
});

test('request auth rejects developer bypass, stale-account cookies and untrusted cookie writes', () => {
  const auth = loadAuth({ TOURMASTER_JWT_SECRET: secret, NODE_ENV: 'development',
    CORS_ORIGINS: 'http://localhost:5173' });
  const session = auth.issueSessionToken(claims);
  const request = (authorization, origin, method = 'GET') => ({
    headers: new Headers({ ...(authorization ? { Authorization: authorization } : {}),
      ...(origin ? { Origin: origin } : {}) }),
    cookies: { get: () => ({ value: session }) },
    method, nextUrl: new URL('http://localhost:5173/api/inventory'),
  });
  assert.equal(auth.getTokenFromRequest(request()).user_id, 42);
  assert.equal(auth.getTokenFromRequest(request('Bearer __dev__')), null);
  assert.equal(auth.getTokenFromRequest(request('Bearer invalid')), null);
  const other = jwt.sign({ ...claims, user_id: 43 }, secret);
  assert.equal(auth.getTokenFromRequest(request('Bearer ' + other)).user_id, 43);
  assert.equal(auth.getTokenFromRequest(request(null, 'https://attacker.example', 'POST')), null);
  assert.equal(auth.getTokenFromRequest(request(null, 'http://localhost:5173', 'POST')).user_id, 42);
});
