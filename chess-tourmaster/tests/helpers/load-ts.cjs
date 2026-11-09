const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

// Isolated module graph without writing compiled files or changing global require hooks.
function createLoader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, mod);
    mod.require = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        if (fs.existsSync(target + '.ts')) return load(target + '.ts');
        if (fs.existsSync(target + '.tsx')) return load(target + '.tsx');
      }
      return Module.prototype.require.call(mod, name);
    };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    mod._compile(code, filename);
    return mod.exports;
  }
  return load;
}

module.exports = { createLoader };
