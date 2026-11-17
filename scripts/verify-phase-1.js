'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** A deterministic source-tree evidence gate, not a production security scan. */
const REQUIRED = Object.freeze([
  'src/modules/manifest.js',
  'src/shared/config/index.js',
  'src/shared/http/errors.js',
  'src/shared/http/responses.js',
  'src/shared/http/request-id.js',
  'src/shared/security/policies.js',
  'src/shared/persistence/unit-of-work.js',
  'src/shared/persistence/optimistic-update.js',
  'src/shared/reliability/operations.js',
  'src/shared/reliability/models.js',
  'src/shared/reliability/outbox.js',
  'tests/transactions/replica-set.test.js',
  'tests/reliability/replica-set.test.js',
  '.github/workflows/backend-ci.yml',
  '.nvmrc',
  'jest.config.js',
  'docs/deferred-issues-register.md',
]);

const HIGH_RISK_DEFERRED = Object.freeze([
  'DEF-001', 'DEF-002', 'DEF-003', 'DEF-012', 'DEF-018',
  'DEF-026', 'DEF-028', 'DEF-029',
]);

function verify(root) {
  const checks = [];
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const check = (id, ok, message) => checks.push({ id, passed: Boolean(ok), message });
  for (const file of REQUIRED) {
    check(`file:${file}`, fs.existsSync(path.join(root, file)), `${file} must exist`);
  }
  if (checks.some((c) => !c.passed)) return { passed: false, checks };
  const moduleManifest = read('src/modules/manifest.js');
  for (const name of ['identity', 'users', 'stores', 'catalog', 'inventory', 'orders', 'fulfillment', 'scheduling', 'delivery', 'payments', 'notifications', 'reporting']) {
    check(`module:${name}`, moduleManifest.includes(`"${name}"`) && fs.existsSync(path.join(root, 'src', 'modules', name, 'README.md')), `module ${name} must be declared and documented`);
  }
  const ci = read('.github/workflows/backend-ci.yml');
  check('ci:jest-coverage', ci.includes('npm run test:coverage'), 'CI must run Jest coverage');
  check('ci:lockfile-install', ci.includes('npm ci'), 'CI must use npm ci');
  check('ci:node-file', ci.includes('node-version-file: .nvmrc'), 'CI must read the Node pin');
  check('ci:no-early-runner-temp', !/MONGOMS_DOWNLOAD_DIR:\s*\$\{\{\s*runner\.temp/.test(ci), 'CI must not reference runner.temp in job env');
  check('node:24', read('.nvmrc').trim() === '24', 'Node major version must remain 24 for this freeze');
  const jestConfig = read('jest.config.js');
  for (const [metric, threshold] of Object.entries({ statements: 60, branches: 55, functions: 50, lines: 60 })) {
    const pattern = new RegExp(`\\b${metric}\\s*:\\s*(\\d+)`);
    const value = Number(jestConfig.match(pattern)?.[1] ?? -1);
    check(`coverage:${metric}`, value >= threshold, `coverage gate ${metric} must be >= ${threshold}%`);
  }
  const register = read('docs/deferred-issues-register.md');
  for (const id of HIGH_RISK_DEFERRED) {
    check(`deferred:${id}`, register.includes(id), `deferred register must preserve ${id}`);
  }
  check('security:profile-risk-visible', register.includes('DEF-026'), 'Other-user profile risk must stay recorded until fixed');
  check('reliability:uncertain-commit-visible', register.includes('DEF-031'), 'Ambiguous commit reconciliation limitation must remain recorded');
  return { passed: checks.every((c) => c.passed), checks };
}

if (require.main === module) {
  const { passed, checks } = verify(path.resolve(__dirname, '..'));
  const failed = checks.filter((c) => !c.passed);
  process.stdout.write(`Phase 1 foundation evidence: ${checks.length - failed.length}/${checks.length} passed\n`);
  for (const item of failed) process.stderr.write(`FAIL ${item.id}: ${item.message}\n`);
  if (!passed) process.exitCode = 1;
  else process.stdout.write('Foundation evidence checks passed. NOT production release approval.\n');
}

module.exports = { verify, REQUIRED, HIGH_RISK_DEFERRED };
