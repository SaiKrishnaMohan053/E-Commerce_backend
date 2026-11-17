# Phase 1 architecture freeze — boundary contract

**Architecture choice:** modular monolith with controller/API → application orchestration → repositories/infrastructure, with domain rules isolated from HTTP/Mongoose. The 12 named modules are architectural boundaries, not functional feature completion.

## Frozen foundation decisions

1. Legacy `/api/*` routes remain backward-compatible during migration. `/api/v2/*` uses shared typed error conventions and a standard envelope when implemented. There are presently no fully implemented v2 business routes.
2. `MongoUnitOfWork` controls MongoDB sessions/transactions; callback may rerun for transient errors. Never perform S3, email, WhatsApp or payment side effects inside it.
3. `UnknownTransactionCommitResult` must never automatically rerun the business operation. Use stable idempotency keys and reconcile database state.
4. Optimistic version updates are explicit for future v2 repositories; legacy stock updates are not magically protected.
5. Idempotency, audit and outbox records are written with the same transaction as business state when integrated into a v2 service. Outbox delivery is at-least-once; provider duplicates need consumer/provider idempotency.
6. Actor roles: Admin, Salesperson, Warehouse Worker, Warehouse Supervisor, Driver. Full persisted role assignment, permission matrix and management UI are future work.
7. Physical shelf count is an absolute observation. Reservations reduce available-to-promise, not physical shelf count; picking physically removes goods. Race safety and business integration are not implemented yet.
8. Use America/Chicago for ordering and delivery schedule rules. The schedule implementation is deferred.
9. One environment-level CI source of truth: Node 24, `npm ci`, Jest with a MongoMemoryReplSet integration suite, minimum coverage 60% statements / 55% branches / 50% functions / 60% lines.
10. All production blockers remain explicit in the deferred issue register. A green test job is not a green security audit.

## Proposed follow-up implementation order

- Establish v2 identity/authorization and actor ownership rules with targeted security hardening.
- Implement catalog/inventory quantity semantics, reservation accounting, and inventory/picking concurrency with transaction tests.
- Integrate v2 order and fulfillment lifecycle with idempotency, audit, and outbox.
- Add scheduling, delivery and payment workflows, notifications, and reporting.
- Integrate frontend and complete staging/production release gates.

**Change control:** after an annotated `phase-1-complete` tag, changes to these contracts require a migration plan, backward-compatibility impact assessment, tests and documented rationale.
