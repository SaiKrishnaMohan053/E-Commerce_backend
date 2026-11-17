const fs = require('fs');
const path = require('path');
const { moduleNames } = require('../../src/modules/manifest');

const modulesRoot = path.resolve(__dirname, '../../src/modules');

function walkJs(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walkJs(file) : entry.isFile() && /\.[cm]?js$/.test(entry.name) ? [file] : [];
  });
}

function importsFrom(source) {
  const specs = [];
  // Static require, ESM import/export-from, and dynamic import with string literals.
  const patterns = [
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) specs.push(match[1]);
  });
  return specs;
}

describe('Phase 1.2 modular boundaries', () => {
  test('all defined modules have a unique name and documentation', () => {
    expect(new Set(moduleNames).size).toBe(moduleNames.length);
    expect(moduleNames.length).toBeGreaterThan(0);
    for (const name of moduleNames) {
      expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(fs.statSync(path.join(modulesRoot, name)).isDirectory()).toBe(true);
      expect(fs.existsSync(path.join(modulesRoot, name, 'README.md'))).toBe(true);
    }
  });

  test('modules only import another module via its public root index', () => {
    for (const sourceModule of moduleNames) {
      const dir = path.join(modulesRoot, sourceModule);
      for (const file of walkJs(dir)) {
        for (const spec of importsFrom(fs.readFileSync(file, 'utf8'))) {
          if (!spec.startsWith('.')) continue;
          const target = path.resolve(path.dirname(file), spec);
          const relative = path.relative(modulesRoot, target).split(path.sep);
          const targetModule = relative[0];
          if (!moduleNames.includes(targetModule) || targetModule === sourceModule) continue;
          const suffix = relative.slice(1).join('/');
          expect(['index', 'index.js', 'index.cjs', 'index.mjs']).toContain(suffix);
        }
      }
    }
  });

  test('domain JavaScript has no direct framework or infrastructure imports', () => {
    const forbidden = /^(?:express|mongoose|mongodb|@aws-sdk(?:\/|$)|node:(?:http|https|fs|net)|http|https|fs|net)(?:\/|$)/;
    for (const name of moduleNames) {
      const folder = path.join(modulesRoot, name, 'domain');
      if (!fs.existsSync(folder)) continue;
      for (const file of walkJs(folder)) {
        const imports = importsFrom(fs.readFileSync(file, 'utf8'));
        for (const spec of imports) expect(spec).not.toMatch(forbidden);
        // Domain must not reach into its own module infrastructure or API layers.
        for (const spec of imports.filter((value) => value.startsWith('.'))) {
          const target = path.resolve(path.dirname(file), spec);
          expect(target.startsWith(path.join(modulesRoot, name, 'infrastructure') + path.sep)).toBe(false);
          expect(target.startsWith(path.join(modulesRoot, name, 'api') + path.sep)).toBe(false);
        }
      }
    }
  });
});
