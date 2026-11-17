'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { TransactionCommitUncertainError } = require('../persistence/unit-of-work');

class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key already belongs to a different request');
    this.name = 'IdempotencyConflictError';
    this.code = 'IDEMPOTENCY_CONFLICT';
    this.statusCode = 409;
  }
}
class IdempotencyResultUncertainError extends Error {
  constructor(cause) {
    super('Operation outcome has not been confirmed; retry with the same key after reconciliation');
    this.name = 'IdempotencyResultUncertainError';
    this.code = 'IDEMPOTENCY_RESULT_UNCERTAIN';
    this.statusCode = 503;
    this.cause = cause;
  }
}
function assertText(value, name, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError(`${name} must be a nonempty string up to ${max} characters`);
  return value;
}
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalized(value[k])]));
  }
  return value;
}
function fingerprint(value) {
  const json = JSON.stringify(normalized(value));
  if (typeof json !== 'string') throw new TypeError('A JSON-serializable request is required');
  return createHash('sha256').update(json).digest('hex');
}
function isDuplicateKey(error) { return Boolean(error && error.code === 11000); }

/**
 * Database-only work. Callback MAY be retried; never email/charge/dispatch from it.
 * All records are written in one MongoUnitOfWork transaction, with one session.
 */
async function executeIdempotent({ uow, models, scope, key, request, work }) {
  if (!uow || typeof uow.run !== 'function' || !models?.Operation) throw new TypeError('uow and models.Operation required');
  assertText(scope, 'scope', 100);
  assertText(key, 'key');
  if (typeof work !== 'function') throw new TypeError('work must be a function');
  const requestHash = fingerprint(request);
  const operationId = `${scope}:${key}`;
  const replay = (existing) => {
    if (existing.requestHash !== requestHash) throw new IdempotencyConflictError();
    return { result: existing.result, replayed: true, operationId };
  };
  const reconcile = async () => models.Operation.findOne({ scope, key }).read('primary').lean();

  try {
    return await uow.run(async (ctx) => {
      const existing = await ctx.bind(models.Operation.findOne({ scope, key }).lean());
      if (existing) return replay(existing);
      const result = await work(Object.freeze({ ...ctx, operationId, models }));
      if (result === undefined || result === null || typeof result !== 'object' || Array.isArray(result)) {
        throw new TypeError('Idempotent work must return a non-null result object');
      }
      // Inserting a terminal record atomically with business changes allows safe replay.
      await models.Operation.create([{ scope, key, requestHash, result, completedAt: new Date() }], ctx.options());
      return { result, replayed: false, operationId };
    });
  } catch (error) {
    if (!isDuplicateKey(error) && !(error instanceof TransactionCommitUncertainError)) throw error;
    // Duplicate unique-key insertion from another committed transaction or ambiguous commit.
    const existing = await reconcile();
    if (existing) return replay(existing);
    if (error instanceof TransactionCommitUncertainError) throw new IdempotencyResultUncertainError(error);
    // Concurrent competing transaction might still be resolving; do not rerun side effects.
    throw new IdempotencyResultUncertainError(error);
  }
}

function validPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('payload must be a non-null object');
  const json = JSON.stringify(payload);
  if (!json || Buffer.byteLength(json, 'utf8') > 65536) throw new TypeError('payload must be JSON serializable and at most 64 KB');
  return payload;
}
async function appendAudit({ models, session, operationId, actorId, action, targetType, targetId, eventId = randomUUID() }) {
  if (!models?.Audit || !session) throw new TypeError('Audit model and transaction session required');
  for (const [name, value] of Object.entries({ operationId, actorId, action, targetType, targetId, eventId })) assertText(value, name);
  const [doc] = await models.Audit.create([{
    eventId, operationId, actorId, action, targetType, targetId, occurredAt: new Date(),
  }], { session });
  return doc;
}
async function enqueueOutbox({ models, session, operationId, type, payload, eventId = randomUUID(), availableAt = new Date() }) {
  if (!models?.Outbox || !session) throw new TypeError('Outbox model and transaction session required');
  for (const [name, value] of Object.entries({ operationId, type, eventId })) assertText(value, name);
  validPayload(payload);
  if (!(availableAt instanceof Date) || Number.isNaN(availableAt.valueOf())) throw new TypeError('availableAt must be a valid Date');
  const [doc] = await models.Outbox.create([{
    eventId, operationId, type, payload, availableAt, createdAt: new Date(), state: 'PENDING', attempts: 0,
  }], { session });
  return doc;
}
module.exports = {
  IdempotencyConflictError, IdempotencyResultUncertainError, fingerprint,
  executeIdempotent, appendAudit, enqueueOutbox,
};
