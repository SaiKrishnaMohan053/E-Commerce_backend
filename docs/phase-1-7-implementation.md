# Phase 1.7 — Idempotency, Audit Trail and Transactional Outbox

## Scope

Only reusable infrastructure for **future v2 application services**. No changes to legacy routes, legacy order controllers, legacy stock calculations, or S3/email/WhatsApp integration.

- `src/shared/reliability/models.js`: models registered on an injected Mongoose connection with unique `(scope,key)` operation index and unique audit/outbox `eventId` indexes. Call `Operation.init()` / `Audit.init()` / `Outbox.init()` when provisioning a new database to ensure unique indexes exist before serving requests.
- `executeIdempotent`: stable caller-supplied idempotency key scoped to principal/operation, canonical SHA-256 request fingerprint, replay of committed result on identical retry, HTTP-friendly `IDEMPOTENCY_CONFLICT` (409) for key reuse with different input, and bounded reconciliation on duplicate-key or `TransactionCommitUncertainError`. If no committed record is visible, return `IDEMPOTENCY_RESULT_UNCERTAIN` rather than silently re-running business side effects.
- `appendAudit`: append-only *service operation*, records actor/action/target/time and operation ID within the transaction. Do not include secrets, tokens, payment credentials, or full PII snapshots. Database collection access control and retention are separate infrastructure concerns.
- `enqueueOutbox`: write event and payload in the **same MongoDB session** as business data and audit. Does not dispatch notifications or call providers.
- `claimOutbox`, `markOutboxDelivered`, `releaseOutbox`: lease-based atomic claim and token-guarded acknowledgement, with delayed retry scheduling. No active background worker, dead-letter policy or transport integration in 1.7.

## Example for future v2 service

```js
const mongoose = require('mongoose');
const { MongoUnitOfWork } = require('./src/shared/persistence');
const { createReliabilityModels, executeIdempotent, appendAudit, enqueueOutbox } = require('./src/shared/reliability');
const models = createReliabilityModels(mongoose.connection);
const uow = new MongoUnitOfWork({ mongoose });

const response = await executeIdempotent({
  uow, models,
  scope: `orders:create:${storeId}`, // must be authorized to act for storeId
  key: validatedIdempotencyKey,     // client reuses exactly the same key for retries
  request: validatedOrderCommand,
  work: async ({ session, operationId }) => {
    const [order] = await OrderV2.create([{ /* normalized order */ }], { session });
    await appendAudit({ models, session, operationId, actorId: String(userId), action: 'order.created', targetType: 'order', targetId: String(order._id) });
    await enqueueOutbox({ models, session, operationId, type: 'OrderCreated', payload: { orderId: String(order._id) } });
    return { orderId: String(order._id) };
  },
});
```

IMPORTANT: The example references future `OrderV2`, `storeId`, `userId`, validated commands and authentication; these are **not implemented** by this patch. Keep external calls **outside** `MongoUnitOfWork.run` because a `TransientTransactionError` may replay the callback. Only database writes inside it.

## Delivery guarantees and limitations

- HTTP/business request idempotency is enforced only when callers integrate `executeIdempotent` and indexes are deployed. No current endpoint has been migrated.
- Outbox delivers at-least-once once a worker is added: a process can send to WhatsApp/email and crash before marking delivered; a retry may send the notification again. Consumer/provider deduplication is mandatory for effectively-once effects. Do not claim exactly-once delivery.
- Unknown commit result reconciliation tries a primary read once. On absent/unavailable record the result remains uncertain; a delayed committed record or in-flight writer may exist. Explicit later reconciliation and alerting remain open.
- The audit module is append-only by convention and application API. Tamper resistance requires database permissions, retention policies, backups, and administrative controls.
- Work may execute twice under transient conflict retries, but only its *committed database effects* are idempotent. Do not invoke external services in work.
- Claim leases use wall-clock scheduling. Workers should use synchronized clocks and implement bounded retries, dead letters, and observability later.

## Test commands

```powershell
npx jest tests/reliability/unit.test.js --runInBand
npx jest tests/reliability/replica-set.test.js --runInBand
npm test -- --watch=false
npm run test:coverage -- --watch=false
```

The replica-set suite uses an isolated `MongoMemoryReplSet` instance. No Atlas DB is touched. The existing standalone `tests/setup.js` remains unchanged; MongoDB driver deprecation warnings are tracked under DEF-010.

## Explicitly deferred

- DEF-002: legacy order and stock behavior is not transactional.
- DEF-031: initial unknown-commit reconciliation implemented, but durable follow-up/recovery endpoint and alerting remain open.
- DEF-032: no running outbox worker, transport adapters, dead-letter processing or provider-side deduplication.
- DEF-033: audit retention, read permissions, immutable DB ACL and long-term access-review process unimplemented.
- DEF-034: no v2 HTTP Idempotency-Key enforcement, canonical request schema or principal scoping until endpoints migrate.
- DEF-010, DEF-012, DEF-013, DEF-026–030 and all other previous open findings remain open.

Review the entire deferred issues register before release. A passing Jest suite is not evidence of Atlas/Render deployment readiness.
