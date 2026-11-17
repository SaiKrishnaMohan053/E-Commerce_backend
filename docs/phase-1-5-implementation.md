# Phase 1.5 — Security implementation

Baseline: feature/phase-1 at `a16a89f`. Run patch script from repository root after extracting ZIP **into repository root**, not `controllers/`.

## Changes
- Authorization middleware: remove raw bearer token from warning log; introduce reusable `authorizeRoles` guard for upcoming v2 routes. Legacy `protect`, `admin`, `employee` remain in place.
- Upload endpoint: require authenticated admin, cap file size to 5MB, accept only listed MIME types, use UUID S3 object keys, avoid reflecting SDK error details. MIME checks are only first-layer checks, not content sniffing or malware scanning.
- Weekly inventory report endpoint: require `protect, admin`.
- Self-profile editing: only allow contact fields; reject known privileged keys, Mongo operator/dotted fields. Unknown harmless keys ignored for compatibility.
- Global rate limiter: no route-group exemptions (100 requests per IP per 15 minutes). Can change high-volume clients; verify usage patterns before production rollout.
- Existing `/api` response bodies preserved; new endpoints use v2 contracts later.

## New security tests
`tests/security/security.test.js` checks policies, role guard, unauthorized upload and report endpoints.

## Explicitly deferred
- DEF-026 high: GET `/api/users/profile/:id` may reveal other users' profiles; route ownership authorization not yet implemented. Release blocker. Also review `GET /api/users/:id` overlap.
- DEF-027 medium: per-endpoint login/password-reset brute-force throttles not in place; global limiter alone is not sufficient for credential stuffing protection.
- DEF-028 high: MIME spoofing/content inspection, registration upload limits and S3 scanning pending.
- DEF-029 high: credential approval email sends plaintext generated password; cryptographically secure credentials and invitation/reset flow pending.
- DEF-030 medium: explicit roles lack persisted schema and role-management lifecycle; RBAC helper is not full role system.
- DEF-012: npm audit vulnerabilities remain unremediated.

## Verify
1. `node apply-phase-1-5.cjs`
2. `node --check index.js; node --check middleware/authmiddleware.js; node --check controllers/userController.js`
3. `npx jest tests/security/security.test.js --runInBand`
4. `npm test -- --watch=false`
5. `npm run test:coverage -- --watch=false`
6. Review `git diff`, then commit and push `feature/phase-1` only after passing tests.

Don't run Node apply script twice. Do not claim success until local tests pass.
