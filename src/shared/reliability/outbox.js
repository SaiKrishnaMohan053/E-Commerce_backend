'use strict';
const { randomUUID } = require('node:crypto');

// Atomic lease claim for workers. No external HTTP/email calls from this module.
async function claimOutbox({ Outbox, now = new Date(), leaseMs = 30000 }) {
  if (!Outbox?.findOneAndUpdate || !(now instanceof Date) || Number.isNaN(+now) || !Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) {
    throw new TypeError('Valid Outbox, now and leaseMs (1000..300000) are required');
  }
  const leaseToken = randomUUID();
  return Outbox.findOneAndUpdate({
    $or: [
      { state: 'PENDING', availableAt: { $lte: now } },
      { state: 'CLAIMED', leaseUntil: { $lte: now } },
    ],
  }, {
    $set: { state: 'CLAIMED', leaseToken, leaseUntil: new Date(now.getTime() + leaseMs) },
    $inc: { attempts: 1 },
  }, { new: true, sort: { createdAt: 1 } });
}
async function markOutboxDelivered({ Outbox, eventId, leaseToken, now = new Date() }) {
  if (!Outbox?.findOneAndUpdate || typeof eventId !== 'string' || !eventId || typeof leaseToken !== 'string' || !leaseToken) throw new TypeError('Outbox, eventId, leaseToken required');
  return Outbox.findOneAndUpdate({ eventId, leaseToken, state: 'CLAIMED', leaseUntil: { $gt: now } }, {
    $set: { state: 'DELIVERED', deliveredAt: now },
    $unset: { leaseUntil: '', leaseToken: '' },
  }, { new: true });
}
async function releaseOutbox({ Outbox, eventId, leaseToken, nextAttemptAt }) {
  if (!Outbox?.findOneAndUpdate || typeof eventId !== 'string' || !eventId || typeof leaseToken !== 'string' || !leaseToken || !(nextAttemptAt instanceof Date) || Number.isNaN(+nextAttemptAt)) throw new TypeError('Outbox, eventId, leaseToken, nextAttemptAt required');
  return Outbox.findOneAndUpdate({ eventId, leaseToken, state: 'CLAIMED' }, {
    $set: { state: 'PENDING', availableAt: nextAttemptAt },
    $unset: { leaseUntil: '', leaseToken: '' },
  }, { new: true });
}
module.exports = { claimOutbox, markOutboxDelivered, releaseOutbox };
