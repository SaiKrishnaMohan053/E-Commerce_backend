# Deferred Issues Register — Phase 1.4 update

Carry forward the Phase 1.3 findings. The register is authoritative only when an issue has explicit code/test evidence for closure. Existing issue IDs remain stable.

| ID | Severity | Issue | Status after 1.4 | Owner / target |
|---|---|---|---|---|
| DEF-001 | Critical | Order number generated once per process | Deferred | Orders |
| DEF-002 | Critical | Nontransactional legacy orders and stock | Deferred | 1.6 + Orders/Inventory |
| DEF-003 | High | Silent quantity truncation | Deferred | Orders |
| DEF-004 | High | Upload authorization, type and size controls | Deferred | 1.5 |
| DEF-005 | High | Weekly inventory report endpoint unprotected | Deferred | 1.5 |
| DEF-006 | High | Bearer token value in authentication logs | Deferred | 1.5 |
| DEF-007 | High | Privileged profile mass assignment | Deferred | 1.5 |
| DEF-008 | High | Global rate-limit exemptions | Deferred | 1.5 |
| DEF-009 | Medium | HTTP listen before MongoDB ready | Fixed in 1.3 (unit tested); real Atlas/Render smoke test pending | Release verification |
| DEF-010 | Medium | Deprecated MongoDB test-setup options | Partially fixed | 1.8 |
| DEF-011 | Medium | `returnres` cancellation typo | Deferred | Order hardening |
| DEF-012 | High | Backend dependency audit vulnerabilities: baseline 48 | Deferred; re-audit before release | 1.5/1.9 |
| DEF-013 | High | Frontend dependency audit vulnerabilities: baseline 68 | Deferred | Frontend security |
| DEF-014 | Medium | Frontend CI build ESLint warnings | Deferred | Frontend CI / Phase 1 final gate |
| DEF-015 | Medium | No frontend tests | Deferred | 1.8 / frontend |
| DEF-016 | Medium | No replica-set transaction integration tests | Deferred | 1.6/1.8 |
| DEF-017 | Medium | Missing CI and pinned Node version | Deferred | 1.8 |
| DEF-018 | High | Physical count/pick ordering ambiguity | Deferred | Inventory/Fulfillment |
| DEF-019 | Medium | Official WhatsApp group eligibility unknown | Deferred | Notifications |
| DEF-020 | Medium | Atlas backup/restore and clean v2 DB setup unverified | Deferred | Migration |
| DEF-021 | Medium | Tracked runtime log files | Fixed in 1.3 (Git commit `bd85fc1`) | Closed |
| DEF-022 | Medium | Legacy controllers use heterogeneous success and error shapes, including raw errors | Intentionally deferred | Per-module v2 migration; 1.4 only defines v2 contracts |
| DEF-023 | Medium | Per-domain input validation schemas are not implemented | Intentionally deferred | Domain implementation / 1.5 security review |
| DEF-024 | Medium | Unexpected runtime DB disconnect and graceful shutdown behaviors | Deferred | Later runtime hardening / release gate |
| DEF-025 | Medium | Legacy helper modules read environment variables directly | Deferred | Module migration |

## Phase 1.4 scoped outcome
- Add shared error classes, request IDs, V2 success/error envelope, safe normalization and test suite.
- **Do not claim DEF-022 is fixed**: no conversion of legacy controller response bodies in this subphase.
- Keep DEF-004–008 scheduled for Phase 1.5. Do not disable existing rate limits to make tests pass.
- Do not claim production readiness from Jest tests alone.

## Issue lifecycle policy
Each subphase report lists Fixed (with evidence), Newly identified, Still open, and Deferred. No issue closes based only on a green global suite.

## Phase 1.5 proposed issue changes

- DEF-004, DEF-005, DEF-006, DEF-007, DEF-008: fixes prepared; mark closed only after local regression and review.
- DEF-026 (High): other-user profile read access at GET /api/users/profile/:id; **OPEN**, authorization/ownership hardening required before release.
- DEF-027 (Medium): login and password-reset specific throttles absent; **OPEN**.
- DEF-028 (High): upload MIME spoofing, malware scanning, registration upload limits; **OPEN**.
- DEF-029 (High): generated password sent by email on approval; **OPEN**.
- DEF-030 (Medium): persisted domain role schema/management missing; guard foundation added only; **OPEN**.
- DEF-001–003, 010–020, 022–025 keep previous scope/status.
- DEF-009 startup fix and DEF-021 Git log hygiene previously verified in Phase 1.3.

## Phase 1.6 — Transaction foundation status

- **DEF-002 — Open:** Transaction Unit of Work infrastructure added, but existing order save/stock updates remain nontransactional. Closing this issue requires v2 order/inventory integration, tests, and review.
- **DEF-016 — Pending local verification:** Replica-set integration tests were added and must pass; CI coverage belongs to Phase 1.8. The default legacy Jest setup still uses standalone MongoMemoryServer and cannot be used to validate transactions.
- **DEF-010 — Open:** Deprecated test-setup MongoDB driver flags remain pending Phase 1.8.
- **DEF-031 — Open, Phase 1.7:** Unknown transaction commit outcomes need operation IDs and reconciliation; external side effects must use transactional outbox/idempotency. No automatic whole-transaction retry for an uncertain commit.
- **Other existing findings:** Preserve the previous statuses for DEF-001, DEF-003–009, DEF-011–015, DEF-017–030. No closure is implied by this infrastructure patch.
- **Release gate:** Atlas/Render replica-set readiness, real failure-mode validation, and application-level transaction usage are still unverified.

## Phase 1.7 — Idempotency, audit and outbox

- **DEF-031 — Partially addressed, still OPEN:** Operation-idempotency record and a primary-read reconciliation path now exist. Unknown commit without a confirmed record remains uncertain. Durable follow-up and operational reconciliation are still required.
- **DEF-032 — New, OPEN (Notifications):** No live outbox dispatcher, consumer/provider deduplication, dead-letter handling, retry caps or provider delivery monitoring. Lease helpers are infrastructure only.
- **DEF-033 — New, OPEN (Security/Operations):** Audit records do not yet have privileged read APIs, tamper-resistant database permissions, retention and backup policy.
- **DEF-034 — New, OPEN (v2 endpoints):** No legacy or v2 HTTP route currently binds Idempotency-Key to an authenticated principal and validated command. Integrate the helper when implementing each write endpoint.
- **DEF-002 — OPEN:** Existing order persistence and stock updates remain outside MongoUnitOfWork.
- **DEF-016 — Replica-set integration verified locally during 1.6; CI coverage still pending 1.8.**
- **All existing security and dependency issues stay open unless previously independently closed.** No other issue IDs were removed or renumbered.

## Phase 1.8 — CI and quality gates (verification pending)

- **DEF-010 — Proposed fixed:** Deprecated `useNewUrlParser` and `useUnifiedTopology` options removed from `tests/setup.js`. Verify no warnings in full local Jest run.
- **DEF-016 — Partial:** Local replica-set suites passed in Phase 1.7. Require green GitHub Actions replica-set runs before closing the CI portion.
- **DEF-017 — Proposed fixed:** GitHub Actions configuration added and Node major pinned to 24 in `.nvmrc`; closure requires a green remote run and review of branch protection.
- **DEF-012 — OPEN:** npm audit JSON is collected but does not block CI; dependency remediation and release gate are still required. Counts must be refreshed from real audit output.
- **DEF-013–015 — OPEN:** Frontend advisories, lint/build and test absence require work in frontend repository.
- **DEF-035 — New, OPEN:** CI currently uses major-tagged GitHub Actions, not immutable SHA-pinned actions. Pin exact reviewed SHAs as security policy requires.
- **DEF-036 — New, OPEN:** Replica-set teardown warnings may appear; monitor CI and add lifecycle diagnostics if warning is coupled to process leaks or failing builds.
- **All other DEF records remain unchanged.** No claim of fix is made until local tests and GitHub Actions execute successfully.
