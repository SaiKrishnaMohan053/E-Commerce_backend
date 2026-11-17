'use strict';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoUnitOfWork, TransactionCommitUncertainError } = require('../../src/shared/persistence');
const {
  createReliabilityModels, executeIdempotent, appendAudit, enqueueOutbox,
  IdempotencyConflictError, claimOutbox, markOutboxDelivered, releaseOutbox,
} = require('../../src/shared/reliability');

jest.setTimeout(120000);
describe('Phase 1.7 MongoDB replica-set reliability integration', () => {
  let replica, db, models, uow, Item;
  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    db = new mongoose.Mongoose();
    await db.connect(replica.getUri('phase17'), { serverSelectionTimeoutMS: 15000 });
    models = createReliabilityModels(db.connection);
    Item = db.model('Phase17Item', new db.Schema({ sku: String, quantity: Number }));
    await Promise.all([models.Operation.init(), models.Audit.init(), models.Outbox.init()]);
    uow = new MongoUnitOfWork({ mongoose: db });
  });
  beforeEach(async () => {
    await Promise.all([models.Operation.deleteMany({}), models.Audit.deleteMany({}), models.Outbox.deleteMany({}), Item.deleteMany({})]);
  });
  afterAll(async () => {
    if (db) await db.disconnect();
    if (replica) await replica.stop();
  });
  async function execute(key = 'order-key', request = { sku: 'ABC', quantity: 2 }, workFn) {
    return executeIdempotent({
      uow, models, scope: 'orders:create:store-1', key, request,
      work: workFn || (async ({ session, operationId }) => {
        const [item] = await Item.create([{ sku: request.sku, quantity: request.quantity }], { session });
        await appendAudit({ models, session, operationId, actorId: 'sales-1', action: 'order.created', targetType: 'order', targetId: String(item._id) });
        await enqueueOutbox({ models, session, operationId, type: 'OrderCreated', payload: { orderId: String(item._id) } });
        return { id: String(item._id) };
      }),
    });
  }
  test('atomic business write, audit and outbox; retries replay result only', async () => {
    const first = await execute();
    const second = await execute();
    expect(first.replayed).toBe(false);
    expect(second).toMatchObject({ replayed: true, result: first.result });
    expect(await Item.countDocuments()).toBe(1);
    expect(await models.Operation.countDocuments()).toBe(1);
    expect(await models.Audit.countDocuments()).toBe(1);
    expect(await models.Outbox.countDocuments()).toBe(1);
  });
  test('same key with different quantity is conflict', async () => {
    await execute();
    await expect(execute('order-key', { sku: 'ABC', quantity: 3 })).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await Item.countDocuments()).toBe(1);
  });
  test('callback failure rolls back business, audit and outbox writes', async () => {
    await expect(execute('fail-key', { sku: 'ABC', quantity: 2 }, async ({ session, operationId }) => {
      await Item.create([{ sku: 'ABC', quantity: 2 }], { session });
      await appendAudit({ models, session, operationId, actorId: 'sales-1', action: 'order.created', targetType: 'order', targetId: 'temp' });
      await enqueueOutbox({ models, session, operationId, type: 'OrderCreated', payload: { id: 'temp' } });
      throw new Error('rolled back');
    })).rejects.toThrow('rolled back');
    expect(await Item.countDocuments()).toBe(0);
    expect(await models.Operation.countDocuments()).toBe(0);
    expect(await models.Audit.countDocuments()).toBe(0);
    expect(await models.Outbox.countDocuments()).toBe(0);
  });
  test('outbox lease cannot be claimed twice or acknowledged using wrong token', async () => {
    await execute();
    const first = await claimOutbox({ Outbox: models.Outbox });
    expect(first.state).toBe('CLAIMED');
    expect(await claimOutbox({ Outbox: models.Outbox })).toBeNull();
    expect(await markOutboxDelivered({ Outbox: models.Outbox, eventId: first.eventId, leaseToken: 'wrong' })).toBeNull();
    expect((await markOutboxDelivered({ Outbox: models.Outbox, eventId: first.eventId, leaseToken: first.leaseToken })).state).toBe('DELIVERED');
    expect(await claimOutbox({ Outbox: models.Outbox })).toBeNull();
  });
  test('failed worker can release event with delayed availability', async () => {
    await execute();
    const claim = await claimOutbox({ Outbox: models.Outbox });
    const later = new Date(Date.now() + 60000);
    const released = await releaseOutbox({ Outbox: models.Outbox, eventId: claim.eventId, leaseToken: claim.leaseToken, nextAttemptAt: later });
    expect(released.state).toBe('PENDING');
    expect(await claimOutbox({ Outbox: models.Outbox })).toBeNull();
    expect(await claimOutbox({ Outbox: models.Outbox, now: new Date(later.getTime() + 1000) })).not.toBeNull();
  });
});
