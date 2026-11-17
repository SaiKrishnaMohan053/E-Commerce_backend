'use strict';

// Registered on an injected Mongoose connection, never the global mongoose singleton.
function createReliabilityModels(connection) {
  if (!connection || typeof connection.model !== 'function' || !connection.base?.Schema) {
    throw new TypeError('A Mongoose connection is required');
  }
  const { Schema } = connection.base;
  const operationSchema = new Schema({
    scope: { type: String, required: true, maxlength: 100 },
    key: { type: String, required: true, maxlength: 160 },
    requestHash: { type: String, required: true },
    result: { type: Schema.Types.Mixed, required: true },
    completedAt: { type: Date, required: true },
  }, { timestamps: true, strict: 'throw' });
  operationSchema.index({ scope: 1, key: 1 }, { unique: true });

  const auditSchema = new Schema({
    eventId: { type: String, required: true, unique: true },
    operationId: { type: String, required: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
  }, { versionKey: false, strict: 'throw' });
  auditSchema.index({ operationId: 1, occurredAt: 1 });

  const outboxSchema = new Schema({
    eventId: { type: String, required: true, unique: true },
    operationId: { type: String, required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    state: { type: String, enum: ['PENDING', 'CLAIMED', 'DELIVERED'], default: 'PENDING', required: true },
    attempts: { type: Number, default: 0, min: 0 },
    availableAt: { type: Date, required: true },
    leaseUntil: Date,
    leaseToken: String,
    deliveredAt: Date,
    createdAt: { type: Date, required: true },
  }, { versionKey: false, strict: 'throw' });
  outboxSchema.index({ state: 1, availableAt: 1, leaseUntil: 1 });

  const register = (name, schema) => connection.models[name] || connection.model(name, schema);
  return Object.freeze({
    Operation: register('ReliabilityOperation', operationSchema),
    Audit: register('ReliabilityAudit', auditSchema),
    Outbox: register('ReliabilityOutbox', outboxSchema),
  });
}
module.exports = { createReliabilityModels };
