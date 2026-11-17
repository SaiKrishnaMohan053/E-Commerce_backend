'use strict';

class ConcurrencyConflictError extends Error {
  constructor() {
    super('Document has been modified or no longer exists');
    this.name = 'ConcurrencyConflictError';
    this.code = 'CONCURRENCY_CONFLICT';
  }
}

/** Conditional versioned update for FUTURE v2 repositories, not legacy controllers. */
async function updateWithVersion({ model, id, expectedVersion, changes, session }) {
  if (!model || typeof model.findOneAndUpdate !== 'function') {
    throw new TypeError('model.findOneAndUpdate is required');
  }
  if (id == null || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new TypeError('id and non-negative integer expectedVersion are required');
  }
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0 ||
      Object.keys(changes).some(k => k.startsWith('$') || k.includes('.') || ['_id', '__v', '__proto__', 'constructor', 'prototype'].includes(k))) {
    throw new TypeError('changes must contain safe top-level fields');
  }
  const updated = await model.findOneAndUpdate(
    { _id: id, __v: expectedVersion },
    { $set: changes, $inc: { __v: 1 } },
    { new: true, runValidators: true, session }
  );
  if (!updated) throw new ConcurrencyConflictError();
  return updated;
}

module.exports = { ConcurrencyConflictError, updateWithVersion };
