'use strict';
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoUnitOfWork, updateWithVersion, ConcurrencyConflictError } = require('../../src/shared/persistence');

// Uses an independent Mongoose instance. Global Jest setup still owns its
// separate standalone MongoMemoryServer for legacy tests.
jest.setTimeout(120000);

describe('real replica-set transaction integration', () => {
  let replica;
  let isolated;
  let Item;
  let uow;

  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    isolated = new mongoose.Mongoose();
    await isolated.connect(replica.getUri('phase16'), { serverSelectionTimeoutMS: 15000 });
    const schema = new isolated.Schema({ name: String, quantity: Number }, { versionKey: '__v' });
    Item = isolated.model('Phase16Item', schema);
    uow = new MongoUnitOfWork({ mongoose: isolated });
  });
  afterEach(async () => {
    if (Item) await Item.deleteMany({});
  });
  afterAll(async () => {
    if (isolated) await isolated.disconnect();
    if (replica) await replica.stop();
  });

  test('commits multiple writes atomically', async () => {
    await uow.run(async ({ options, bind }) => {
      await Item.create([{ name: 'A', quantity: 5 }], options());
      await Item.create([{ name: 'B', quantity: 7 }], options());
      expect(await bind(Item.find({})).countDocuments()).toBe(2);
    });
    expect(await Item.countDocuments()).toBe(2);
  });

  test('rolls back all writes after exception', async () => {
    await expect(uow.run(async ({ options }) => {
      await Item.create([{ name: 'A', quantity: 5 }], options());
      await Item.create([{ name: 'B', quantity: 7 }], options());
      throw new Error('abort test');
    })).rejects.toThrow('abort test');
    expect(await Item.countDocuments()).toBe(0);
  });

  test('conditional version update rejects stale writes', async () => {
    const saved = await Item.create({ name: 'A', quantity: 5 });
    await uow.run(async ({ session }) => {
      const first = await updateWithVersion({ model: Item, id: saved._id, expectedVersion: 0, changes: { quantity: 4 }, session });
      expect(first.__v).toBe(1);
    });
    await expect(uow.run(({ session }) => updateWithVersion({
      model: Item, id: saved._id, expectedVersion: 0, changes: { quantity: 100 }, session,
    }))).rejects.toBeInstanceOf(ConcurrencyConflictError);
    const current = await Item.findById(saved._id);
    expect(current.quantity).toBe(4);
    expect(current.__v).toBe(1);
  });
});
