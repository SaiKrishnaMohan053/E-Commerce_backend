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
