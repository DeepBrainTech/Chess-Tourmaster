const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadCors(origins) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/http.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, process: { env: { CORS_ORIGINS: origins } }, Response };
  vm.runInNewContext(code, context);
  return context.exports;
}

test('CORS allows only exact configured origins on responses and preflight', () => {
  const cors = loadCors(' http://localhost:5173, , https://game.example.com ');
  for (const origin of ['http://localhost:5173', 'https://game.example.com']) {
    assert.equal(cors.getCorsHeaders(origin)['Access-Control-Allow-Origin'], origin);
    assert.equal(cors.optionsResponse(origin).headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(cors.jsonResponse({ ok: true }, undefined, origin).headers.get('Access-Control-Allow-Origin'), origin);
  }
  for (const origin of [undefined, 'null', 'http://localhost:3000', 'https://game.example.com.attacker.test']) {
    assert.equal(cors.optionsResponse(origin).headers.has('Access-Control-Allow-Origin'), false);
    assert.equal(cors.jsonResponse({}, undefined, origin).headers.has('Access-Control-Allow-Origin'), false);
  }
  assert.equal(cors.optionsResponse('http://localhost:5173').headers.get('Vary'), 'Origin');
});

test('CORS fails closed for unset, empty or wildcard configuration', () => {
  for (const config of [undefined, '', ' , ', '*']) {
    assert.equal(loadCors(config).getCorsHeaders('https://untrusted.example')['Access-Control-Allow-Origin'], undefined);
  }
});
