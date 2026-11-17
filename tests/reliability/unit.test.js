'use strict';
const {
  fingerprint, executeIdempotent, appendAudit, enqueueOutbox,
  IdempotencyConflictError, IdempotencyResultUncertainError,
  claimOutbox, markOutboxDelivered, releaseOutbox,
} = require('../../src/shared/reliability');
const { TransactionCommitUncertainError } = require('../../src/shared/persistence');

describe('Phase 1.7 reliability unit contracts', () => {
  test('hash canonicalizes equivalent request objects', () => {
    expect(fingerprint({ b: 2, a: { z: 1, y: 2 } })).toBe(fingerprint({ a: { y: 2, z: 1 }, b: 2 }));
    expect(fingerprint({ qty: 2 })).not.toBe(fingerprint({ qty: 3 }));
  });
  test('rejects bad keys or callbacks before writing', async () => {
    await expect(executeIdempotent({ uow: { run: jest.fn() }, models: { Operation: {} }, scope: '', key: 'a', request: {}, work: () => ({}) })).rejects.toThrow('scope');
  });
  test('same key and hash replay completed stored result without callback', async () => {
    const existing = { requestHash: fingerprint({ quantity: 3 }), result: { id: 'first' } };
    const query = { lean: () => ({ session: async () => existing }) };
    const Operation = { findOne: jest.fn(() => query) };
    const uow = { run: fn => fn({ session: {}, bind: q => q.session(), options: () => ({ session: {} }) }) };
    const work = jest.fn();
    const result = await executeIdempotent({ uow, models: { Operation }, scope: 'orders', key: 'k', request: { quantity: 3 }, work });
    expect(result).toMatchObject({ result: { id: 'first' }, replayed: true });
    expect(work).not.toHaveBeenCalled();
  });
  test('reused key with altered request rejects 409', async () => {
    const existing = { requestHash: fingerprint({ quantity: 1 }), result: { id: 'first' } };
    const Operation = { findOne: () => ({ lean: () => ({ session: async () => existing }) }) };
    const uow = { run: fn => fn({ bind: q => q.session() }) };
    await expect(executeIdempotent({ uow, models: { Operation }, scope: 'orders', key: 'k', request: { quantity: 2 }, work: jest.fn() }))
      .rejects.toBeInstanceOf(IdempotencyConflictError);
  });
  test('unknown commit reconciles existing record without rerunning work', async () => {
    const existing = { requestHash: fingerprint({ quantity: 1 }), result: { id: 'saved' } };
    const Operation = { findOne: () => ({ read: () => ({ lean: async () => existing }) }) };
    const uow = { run: jest.fn(async () => { throw new TransactionCommitUncertainError(new Error('timeout')); }) };
    const work = jest.fn();
    const output = await executeIdempotent({ uow, models: { Operation }, scope: 'orders', key: 'k', request: { quantity: 1 }, work });
    expect(output.result.id).toBe('saved');
    expect(work).not.toHaveBeenCalled();
  });
  test('unknown commit without reconciliation returns uncertainty instead of rerunning work', async () => {
    const Operation = { findOne: () => ({ read: () => ({ lean: async () => null }) }) };
    const uow = { run: async () => { throw new TransactionCommitUncertainError(new Error('timeout')); } };
    await expect(executeIdempotent({ uow, models: { Operation }, scope: 'orders', key: 'k', request: {}, work: jest.fn() }))
      .rejects.toBeInstanceOf(IdempotencyResultUncertainError);
  });
  test('audit and outbox require a transaction session', async () => {
    await expect(appendAudit({ models: { Audit: {} }, operationId: 'o' })).rejects.toThrow('session');
    await expect(enqueueOutbox({ models: { Outbox: {} }, operationId: 'o' })).rejects.toThrow('session');
  });
  test('audit and outbox pass identical transaction session to Mongoose', async () => {
    const session = {};
    const Audit = { create: jest.fn().mockResolvedValue([{}]) };
    const Outbox = { create: jest.fn().mockResolvedValue([{}]) };
    await appendAudit({ models: { Audit }, session, operationId: 'o', actorId: 'u', action: 'order.created', targetType: 'order', targetId: 'x' });
    await enqueueOutbox({ models: { Outbox }, session, operationId: 'o', type: 'OrderCreated', payload: { id: 'x' } });
    expect(Audit.create.mock.calls[0][1]).toEqual({ session });
    expect(Outbox.create.mock.calls[0][1]).toEqual({ session });
  });
  test('outbox payload rejects non-objects and oversize content', async () => {
    const args = { models: { Outbox: { create: jest.fn() } }, session: {}, operationId: 'op', type: 'T' };
    await expect(enqueueOutbox({ ...args, payload: 'raw' })).rejects.toThrow('payload');
    await expect(enqueueOutbox({ ...args, payload: { x: 'a'.repeat(65536) } })).rejects.toThrow('64 KB');
    expect(args.models.Outbox.create).not.toHaveBeenCalled();
  });
  test('worker claim is atomic and guarded by lease', async () => {
    const findOneAndUpdate = jest.fn().mockResolvedValue({ eventId: 'e' });
    const Outbox = { findOneAndUpdate };
    const now = new Date('2026-01-01T00:00:00Z');
    await claimOutbox({ Outbox, now, leaseMs: 5000 });
    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    expect(filter.$or).toHaveLength(2);
    expect(update.$set.state).toBe('CLAIMED');
    expect(update.$inc.attempts).toBe(1);
    expect(options.new).toBe(true);
    await markOutboxDelivered({ Outbox, eventId: 'e', leaseToken: 'l', now });
    expect(findOneAndUpdate.mock.calls[1][0]).toMatchObject({ eventId: 'e', leaseToken: 'l', state: 'CLAIMED' });
    await releaseOutbox({ Outbox, eventId: 'e', leaseToken: 'l', nextAttemptAt: now });
    expect(findOneAndUpdate.mock.calls[2][1].$set.state).toBe('PENDING');
  });
});
