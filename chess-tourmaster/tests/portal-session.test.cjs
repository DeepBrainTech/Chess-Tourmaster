const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, window = { location: { href: 'http://localhost:5173/' } }) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, process: { env: {} }, window, Date, Headers, atob,
    URLSearchParams, sessionStorage: { getItem: () => null, setItem() {} },
    require: name => dependencies[name] };
  vm.runInNewContext(code, context);
  return context.exports;
}
const user = { user_id: 42, username: 'portal-user' };
const json = (body, status = 200) => Response.json(body, { status });
const verified = () => json({ success: true, user });
const session = token => json({ success: true, data: { game_token: token, user: { id: 42 } } });
function client(request, redirect = () => {}) {
  const { PortalSessionClient } = load('lib/portal-session.ts', { './apiBase': {
    getApiBase: () => '', getPortalApiBase: () => 'http://localhost:8000',
    getPortalUrl: (page, locale) => `http://localhost:3000/${locale === 'zn' ? 'zh' : locale}/${page}`,
  } });
  return new PortalSessionClient(request, redirect);
}

test('launch token must pass backend verification and bootstrap runs once', async () => {
  const requests = [];
  const auth = client(async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer launch-token');
    return verified();
  });
  const first = auth.bootstrap('launch-token', 'en');
  assert.equal(auth.bootstrap(null, 'en'), first);
  assert.equal((await first).user_id, 42);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/auth/verify');
  assert.equal(requests[0].options.credentials, 'include');
});

test('local direct opening restores a real portal session instead of a developer user', async () => {
  const requests = [];
  const auth = client(async url => {
    requests.push(url);
    return url.endsWith('/session') ? session('fresh-token') : verified();
  });
  assert.equal((await auth.bootstrap(null, 'en')).username, 'portal-user');
  assert.deepEqual(requests, ['http://localhost:8000/api/games/chess-tourmaster/session', '/api/auth/verify']);
});

test('401 refresh is shared by simultaneous requests and each retries only once', async () => {
  let refreshes = 0;
  const attempts = [];
  const auth = client(async (url, options) => {
    if (url.endsWith('/verify')) return verified();
    if (url.endsWith('/session')) { refreshes++; return session('renewed-token'); }
    const token = options.headers.get('Authorization');
    attempts.push(token);
    assert.equal(options.credentials, 'include');
    return json({}, token === 'Bearer renewed-token' ? 200 : 401);
  });
  await auth.bootstrap('old-token', 'en');
  const results = await Promise.all([auth.gameFetch('/api/inventory'), auth.gameFetch('/api/progress/load')]);
  assert.deepEqual(results.map(result => result.status), [200, 200]);
  assert.equal(refreshes, 1);
  assert.equal(attempts.length, 4);
});

test('portal 401 redirects to the localized login and never restores a stale game cookie', async () => {
  const requests = [], redirects = [];
  const auth = client(async url => { requests.push(url); return json({}, 401); }, url => redirects.push(url));
  assert.equal(await auth.bootstrap(null, 'zn'), null);
  assert.equal(requests.length, 1);
  assert.match(redirects[0], /^http:\/\/localhost:3000\/zh\/login\?next=/);
});

test('portal outage allows restoring the verified game cookie without a readable token', async () => {
  const auth = client(async url => url.endsWith('/session') ? json({}, 503) : verified());
  assert.equal((await auth.bootstrap(null, 'en')).user_id, 42);
});

test('account change stops refresh before replacing the cookie or retrying a mutation', async () => {
  let verifies = 0, mutations = 0;
  const redirects = [];
  const auth = client(async url => {
    if (url.endsWith('/verify')) { verifies++; return verified(); }
    if (url.endsWith('/session')) return json({ success: true, data: { game_token: 'other', user: { id: 43 } } });
    mutations++;
    return json({}, 401);
  }, url => redirects.push(url));
  await auth.bootstrap('original', 'en');
  assert.equal((await auth.gameFetch('/api/hint/use', { method: 'POST' })).status, 401);
  assert.equal(verifies, 1);
  assert.equal(mutations, 1);
  assert.equal(redirects.length, 1);
  await assert.rejects(auth.gameFetch('/api/hint/use'), /portal_login_required/);
});

test('return links map Chinese to zh and keep the local host when no URL is configured', () => {
  for (const hostname of ['localhost', '127.0.0.1', '192.168.1.20']) {
    const api = load('lib/apiBase.ts', {}, { location: { hostname } });
    assert.equal(api.getPortalUrl('braingames', 'zn'), `http://${hostname}:3000/zh/braingames`);
    assert.equal(api.getPortalApiBase(), `http://${hostname}:8000`);
  }
  const production = load('lib/apiBase.ts', {}, { location: { hostname: 'knightours-chess.deepbraintechnology.com' } });
  assert.equal(production.getPortalUrl('login', 'en'), 'https://deepbraintechnology.com/en/login');
});

test('launch captures language and display balances, clearing the token from the URL', () => {
  let cleaned;
  const browser = { location: { hash: '#token=secret&locale=zh-CN&coins=8&diamonds=invalid',
    search: '?locale=en', pathname: '/' }, history: { replaceState: (...args) => { cleaned = args[2]; } } };
  const launch = load('lib/portal-session.ts', { './apiBase': {} }, browser).captureLaunchContext();
  assert.equal(launch.token, 'secret');
  assert.equal(launch.portalLocale, 'zn');
  assert.equal(launch.assets.coins, 8);
  assert.equal(launch.assets.diamonds, 0);
  assert.equal(cleaned, '/?locale=en');
});
