# Phase 1.3 — Configuration & startup readiness

## Scope

- Validated non-test runtime configuration; no third-party dependency introduced.
- MongoDB readiness precedes HTTP listening; failed connection prevents service startup.
- Production CORS uses explicit HTTPS origins, excluding implicit localhost.
- MongoDB obsolete connection flags removed from API startup (test setup still deferred to 1.8).
- Winston console-only transport for Render; tracked runtime logs removed from Git index, not local disk.
- Environment example expanded; test-mode startup stays compatible with Supertest.

## Local application steps (from backend repository root)

```powershell
# Create branch off the Phase 1.2 feature branch
# git switch feature/phase-1-2-module-foundation
# git switch -c feature/phase-1-3-config-startup
# Extract patch to backend root; preserve layout.
# git rm --cached logs/combined.log logs/error.log
npm test -- --watch=false
npm run test:coverage -- --watch=false
git status --short
git diff --check
git add index.js .env.example .gitignore utils/logger.js src/shared/config src/shared/runtime tests/config docs
# git diff --cached --check
# git diff --cached --stat
# git commit -m "feat(config): validate environment and gate startup on MongoDB"
```

The tracked log files must be untracked with `git rm --cached` so their existing local copies are not deleted. Before that command, do not include log contents in commits.

## Configuration notes

- `NODE_ENV=production` requires valid `MONGO_URI`, JWT_SECRET >= 32 characters, HTTPS `FRONTEND_URL`, complete AWS S3 settings and EMAIL_USER/EMAIL_PASS.
- Development requires MongoDB URI and a non-empty JWT secret; S3/email settings are optional only if entirely absent.
- Replace all placeholders in copied `.env`; `.env.example` is illustrative, not a runnable production configuration.
- Don't paste real credentials or connection URLs into ChatGPT or Git.
- Render must use a real MongoDB Atlas URI; ensure Atlas network policies allow the Render service.
- This change doesn't contact Atlas in test mode. Transaction support is separately verified in Phase 1.6.
- Built-in AWS client configuration remains legacy behavior; AWS IAM role/credential provider chain improvements belong to security hardening.
- Health endpoints, Render graceful shutdown, JWT rotation, token leak, auth routes, order/stock writes, and versioned API errors are deferred.

## Test expectations

- Previous 121 tests continue to pass.
- New configuration and startup-readiness tests pass.
- No network side effects or database reset needed for config-only tests.
- `index.js` continues exporting the same Express app for Supertest.

## Limitations

Config is validated at startup, but legacy helpers may continue reading `process.env` at module import time. Later modules should consume the centralized config object. Some paths (email delivery and S3 upload) cannot be exercised with development-only missing optional credentials; these features require valid settings. The new configuration does not change legacy `/api` response envelopes.
