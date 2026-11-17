# Phase 1.8 — Backend Testing & CI Quality Gates

## Baseline (locally verified in Phase 1.7)
- 17 Jest suites / 194 tests pass.
- Global coverage: 61.50% statements, 57.03% branches, 51.07% functions, 62.05% lines.
- Replica-set integration tests run in independent MongoMemoryReplSet instances.

## Changes
- `.github/workflows/backend-ci.yml`: push to `feature/phase-1` or `main`, PR to `main`, manual dispatch.
- GitHub Actions use Node 24 from `.nvmrc`, `npm ci`, Ubuntu 22.04, and MongoDB binary 7.0.14.
- Coverage thresholds in Jest enforce a low-water baseline: 60% statements, 55% branches, 50% functions and 60% lines.
- `tests/setup.js`: remove deprecated MongoDB driver options; standalone in-memory DB is preserved for legacy suites.
- npm audit is intentionally non-blocking until advisory remediation is planned. Audit JSON remains visible as an artifact. Do not treat the green test job as production security approval.

## Validation
Run locally:
```
node --version
npm ci
npm test -- --watch=false
npm run test:coverage -- --watch=false
npm audit --json > npm-audit.json
```
`npm audit` can have a nonzero status due to known vulnerabilities; do not commit npm-audit.json.

Verify GitHub Actions at the commit after pushing. The workflow must run real transaction/reliability integration tests and pass coverage gates. No Atlas credentials, WhatsApp keys or SMTP secrets are required.

## Explicit limits
- No frontend CI or frontend test introduction in this backend repository.
- No changes to legacy order/stock behavior, transaction orchestration, domain boundaries, auth logic or production routes.
- Two replica sets run sequentially in Jest; teardown ECONNRESET warnings may still appear on Windows or Linux even when tests pass. Investigate persistent failures rather than suppressing warnings.
- Neither global coverage nor current tests prove correctness of unimplemented v2 domain modules.
- Full dependency remediation, production Atlas/Render smoke tests, high-severity deferred security issues and CI branch protection remain release gates.
