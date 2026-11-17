# Phase 1.6 — MongoDB Transactions & Unit of Work

## Scope

- Add `MongoUnitOfWork` shared persistence infrastructure for future `/api/v2` service/repository operations.
- Explicit MongoDB sessions, snapshot reads, majority-acknowledged writes, primary reads, rollback, and session disposal.
- Retry the **whole transaction** only on `TransientTransactionError` and only up to a configured maximum (default 3 attempts).
- On `UnknownTransactionCommitResult`, retry **only commit** (default up to 3 attempts). When still uncertain, throw `TransactionCommitUncertainError`; caller must reconcile by a stable operation ID. Never rerun callback in this condition.
- `sessionContext.options()` for writes and `sessionContext.bind(query)` for reads.
- Conditional `__v` updates via `updateWithVersion()`. A stale version raises `ConcurrencyConflictError`.
- Tests: deterministic mock session/retry tests and isolated single-node `MongoMemoryReplSet` integration tests (commit, rollback, stale update).

## Rules for future service code

```js
const { MongoUnitOfWork, updateWithVersion } = require('./src/shared/persistence');
const uow = new MongoUnitOfWork({ mongoose });
await uow.run(async ({ session, options, bind }) => {
  await SomeModel.create([{ /* fields */ }], options());
  const docs = await bind(OtherModel.find({ status: 'pending' }));
  await updateWithVersion({ model: OtherModel, id: docs[0]._id, expectedVersion: docs[0].__v, changes: { status: 'reserved' }, session });
});
```

**Do not perform external side effects inside transaction callback**, as transient errors may cause the callback to execute multiple times. In Phase 1.7, use an outbox record written with the transaction; dispatch after commit. `__v` is managed by this helper for v2 and is not retroactively enforced on legacy controllers.

## Test instructions

```powershell
npx jest tests/transactions/unit-of-work.test.js --runInBand
npx jest tests/transactions/replica-set.test.js --runInBand
npm test -- --watch=false
npm run test:coverage -- --watch=false
```

Replica-set integration tests need enough RAM, local MongoDB-memory-server binary availability, and first-run binary downloads if the binary isn't cached. They do **not** use the project's Atlas database. The existing standalone memory-server tests stay unchanged. Test timeout for the replica-set suite is 120 seconds.

## Explicitly out of scope

- No changes to legacy order controller, legacy inventory stock deductions, or route behavior.
- No reservation, physical stock, staged stock, idempotency/outbox or audit implementation yet.
- No global session injection into legacy Mongoose calls.
- No production Atlas/Render smoke-test claim, replica-set failover drills, or distributed lock implementation.

## Deferred findings

Keep DEF-001–008, 010–020, 022–030 at their previous statuses except for infrastructure progress against DEF-002 and DEF-016. DEF-002 remains **open** because legacy order operations do not use transactions. DEF-016 remains **open** until real replica-set tests pass locally and CI coverage is addressed in Phase 1.8. DEF-009 and DEF-021 remain previously closed as recorded. Additional risk: unknown commit outcomes require application-level operation identifiers and reconciliation, targeted for Phase 1.7.
