'use strict';
const { MongoUnitOfWork, TransactionCommitUncertainError } = require('../../src/shared/persistence');
const { updateWithVersion, ConcurrencyConflictError } = require('../../src/shared/persistence');

function labelled(label) {
  const e = new Error(label);
  e.hasErrorLabel = (candidate) => candidate === label;
  return e;
}
function fakeSession(commit = jest.fn().mockResolvedValue()) {
  let active = false;
  return {
    startTransaction: jest.fn(() => { active = true; }),
    commitTransaction: jest.fn(async () => { await commit(); active = false; }),
    abortTransaction: jest.fn(async () => { active = false; }),
    endSession: jest.fn(),
    inTransaction: () => active,
  };
}

describe('MongoUnitOfWork (isolated session mocks)', () => {
  test('commits, passes session to query and closes session', async () => {
    const s = fakeSession();
    const work = jest.fn(async ({ session, bind, options }) => {
      const q = { session: jest.fn().mockReturnValue('bound') };
      expect(bind(q)).toBe('bound');
      expect(q.session).toHaveBeenCalledWith(s);
      expect(options()).toEqual({ session: s });
      expect(session).toBe(s);
      return 'done';
    });
    expect(await new MongoUnitOfWork({ mongoose: { startSession: async () => s } }).run(work)).toBe('done');
    expect(s.commitTransaction).toHaveBeenCalledTimes(1);
    expect(s.abortTransaction).not.toHaveBeenCalled();
    expect(s.endSession).toHaveBeenCalledTimes(1);
  });

  test('aborts on callback error without retry', async () => {
    const s = fakeSession();
    const work = jest.fn(async () => { throw new Error('validation failed'); });
    await expect(new MongoUnitOfWork({ mongoose: { startSession: async () => s } }).run(work))
      .rejects.toThrow('validation failed');
    expect(work).toHaveBeenCalledTimes(1);
    expect(s.abortTransaction).toHaveBeenCalledTimes(1);
    expect(s.endSession).toHaveBeenCalledTimes(1);
  });

  test('transient errors retry whole transaction with fresh session, bounded', async () => {
    const sessions = [fakeSession(), fakeSession()];
    const startSession = jest.fn().mockResolvedValueOnce(sessions[0]).mockResolvedValueOnce(sessions[1]);
    const work = jest.fn().mockRejectedValueOnce(labelled('TransientTransactionError')).mockResolvedValueOnce(42);
    expect(await new MongoUnitOfWork({ mongoose: { startSession }, maxAttempts: 2 }).run(work)).toBe(42);
    expect(startSession).toHaveBeenCalledTimes(2);
    expect(sessions[0].abortTransaction).toHaveBeenCalledTimes(1);
    expect(sessions[1].commitTransaction).toHaveBeenCalledTimes(1);
    expect(sessions[0].endSession).toHaveBeenCalledTimes(1);
  });

  test('transient error does not exceed retry limit', async () => {
    const sessions = [fakeSession(), fakeSession()];
    const startSession = jest.fn().mockResolvedValueOnce(sessions[0]).mockResolvedValueOnce(sessions[1]);
    const work = jest.fn(async () => { throw labelled('TransientTransactionError'); });
    await expect(new MongoUnitOfWork({ mongoose: { startSession }, maxAttempts: 2 }).run(work))
      .rejects.toThrow('TransientTransactionError');
    expect(work).toHaveBeenCalledTimes(2);
    expect(sessions.every(s => s.endSession.mock.calls.length === 1)).toBe(true);
  });

  test('unknown commit result retries only commit, not callback', async () => {
    const commit = jest.fn().mockRejectedValueOnce(labelled('UnknownTransactionCommitResult')).mockResolvedValueOnce();
    const s = fakeSession(commit);
    const work = jest.fn().mockResolvedValue('ok');
    expect(await new MongoUnitOfWork({ mongoose: { startSession: async () => s } }).run(work)).toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  test('unknown commit result after limit throws uncertain outcome, never reruns work', async () => {
    const commit = jest.fn(async () => { throw labelled('UnknownTransactionCommitResult'); });
    const s = fakeSession(commit);
    const work = jest.fn().mockResolvedValue('ok');
    await expect(new MongoUnitOfWork({ mongoose: { startSession: async () => s }, maxCommitAttempts: 2 }).run(work))
      .rejects.toBeInstanceOf(TransactionCommitUncertainError);
    expect(work).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  test('bad dependency and retry configuration rejected', () => {
    expect(() => new MongoUnitOfWork({})).toThrow('mongoose');
    expect(() => new MongoUnitOfWork({ mongoose: { startSession() {} }, maxAttempts: 0 })).toThrow('maxAttempts');
  });
});

describe('optimistic concurrency helper', () => {
  test('updates only matching version with increment', async () => {
    const findOneAndUpdate = jest.fn().mockResolvedValue({ __v: 4 });
    const out = await updateWithVersion({ model: { findOneAndUpdate }, id: 'id1', expectedVersion: 3, changes: { stock: 8 }, session: 's' });
    expect(out.__v).toBe(4);
    expect(findOneAndUpdate).toHaveBeenCalledWith({ _id: 'id1', __v: 3 },
      { $set: { stock: 8 }, $inc: { __v: 1 } }, { new: true, runValidators: true, session: 's' });
  });
  test('conflicting update rejects and never silently overwrites', async () => {
    await expect(updateWithVersion({ model: { findOneAndUpdate: async () => null }, id: 'x', expectedVersion: 1, changes: { stock: 2 } }))
      .rejects.toBeInstanceOf(ConcurrencyConflictError);
  });
  test('rejects operator injection and version mutation', async () => {
    const model = { findOneAndUpdate: jest.fn() };
    for (const changes of [{ $inc: { stock: 100 } }, { '__v': 6 }, { 'stock.value': 2 }]) {
      await expect(updateWithVersion({ model, id: 'x', expectedVersion: 0, changes })).rejects.toThrow(TypeError);
    }
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
