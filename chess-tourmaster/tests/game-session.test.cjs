const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');

test('session orders timer transitions before hints and saves, and retries use the same attempt and position', async () => {
  const requests = [];
  let failHint = true;
  const load = createLoader({ '../portal-session': { gameFetch: async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    if (url === '/api/hint/use' && failHint) { failHint = false; throw new Error('lost response'); }
    return { ok: true, json: async () => ({ success: true, data: body.action === 'start'
      ? { attempt_id: 'test-attempt', level_version: 2 } : url === '/api/hint/use' ? { hint_count: 1, move: { r: 1, c: 2 } } : {} }) };
  } } });
  const { GameSessionClient } = load('lib/game/sessionClient.ts');
  const client = new GameSessionClient();
  await client.start(1, 'classic');
  const pause = client.transition('pause');
  const hint = client.hint([]);
  await pause;
  await assert.rejects(hint, /lost response/);
  assert.deepEqual(await client.hint([]), { hint_count: 1, move: { r: 1, c: 2 } });
  const resume = client.transition('resume');
  const save = client.finish([{ r: 1, c: 2 }]);
  await Promise.all([resume, save]);
  assert.deepEqual(requests.map(r => r.body.action ?? r.url),
    ['start', 'pause', '/api/hint/use', '/api/hint/use', 'resume', '/api/progress/save']);
  assert.deepEqual(requests[2].body, requests[3].body);
  assert.equal(requests[5].body.attempt_id, 'test-attempt');
});

test('failed timer transition blocks mutations until a successful synchronization', async () => {
  let failed = false;
  const load = createLoader({ '../portal-session': { gameFetch: async (_, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'pause' && !failed) { failed = true; return { ok: false, json: async () => ({ code: 'SERVER_ERROR' }) }; }
    return { ok: true, json: async () => ({ success: true, data: { attempt_id: 'attempt', level_version: 2 } }) };
  } } });
  const { GameSessionClient } = load('lib/game/sessionClient.ts');
  const client = new GameSessionClient();
  await client.start(1, 'classic');
  await assert.rejects(client.transition('pause'), /SERVER_ERROR/);
  await assert.rejects(client.hint([]), /SERVER_ERROR/);
  await client.transition('resume');
  await client.finish([]);
});

test('client refuses a server board version it cannot reproduce', async () => {
  const load = createLoader({ '../portal-session': { gameFetch: async () => ({ ok: true,
    json: async () => ({ success: true, data: { attempt_id: 'wrong-version', level_version: 999 } }) }) } });
  const { GameSessionClient } = load('lib/game/sessionClient.ts');
  const client = new GameSessionClient();
  await assert.rejects(client.start(1, 'classic'), /VERSION_MISMATCH/);
  assert.equal(client.id, null);
});
