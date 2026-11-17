# Phase 1.4 — Shared HTTP error and response contracts

Base: `feature/phase-1` commit `bd85fc1`. Apply the ZIP **at backend root**, not inside `controllers/`.

## Nonbreaking strategy
- Legacy `/api/*` routes keep their existing response format. No legacy controllers or route handlers changed.
- New `/api/v2/*` routes can use `success(res, {...})` for 2xx JSON and throw `AppError` derivatives for errors.
- The fallback 404 for `/api/v2/*` uses `{success:false,error:{code,message,requestId}}`.
- Server generates `X-Request-ID` for each request, including legacy endpoints. Client-provided IDs are ignored. CORS exposes this header to allowed origins.
- Unexpected V2 errors never send raw exception messages, stack traces or database values.

## Integration
The root `middleware/errormiddleware.js` delegates to shared implementation so existing imports remain stable. Existing `index.js` inserts request-id before CORS.

## Verification
1. `git status --short` and check files are at root, not under `controllers/`.
2. `npx jest tests/http/http-contracts.test.js --runInBand`
3. `npm test -- --watch=false`
4. `npm run test:coverage -- --watch=false`
5. `git diff --check`; review diff; stage the files listed in this patch only.
6. Commit `feat(http): introduce versioned API response contracts and request IDs` and push `feature/phase-1`.

## Boundaries
No full V2 routes are mounted yet; `/api/v2/*` unknown routes return standardized 404. MongoDB errors thrown from future V2 routes are mapped. Existing legacy JSON error responses are deliberately unchanged. RBAC, uploads, token logging and rate limiting belong to 1.5. Transactional persistence belongs to 1.6. Validation schemas per domain are future module work.
