'use strict';

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_COMMIT_ATTEMPTS = 3;

class TransactionCommitUncertainError extends Error {
  constructor(cause) {
    super('Transaction commit outcome is unknown; reconcile state before retrying the business operation');
    this.name = 'TransactionCommitUncertainError';
    this.code = 'TRANSACTION_COMMIT_UNCERTAIN';
    this.cause = cause;
  }
}

function hasErrorLabel(error, label) {
  return Boolean(error && typeof error.hasErrorLabel === 'function' && error.hasErrorLabel(label));
}

function checkAttempts(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new RangeError(`${name} must be an integer between 1 and 10`);
  }
}

function sessionContext(session) {
  return Object.freeze({
    session,
    options: () => ({ session }),
    bind: (query) => {
      if (!query || typeof query.session !== 'function') {
        throw new TypeError('bind() requires a Mongoose query with a .session() method');
      }
      return query.session(session);
    },
  });
}

/**
 * Runs ONLY MongoDB operations in a session-scoped transaction.
 * Work may be re-executed on transient transaction errors; never email,
 * charge cards, call S3 or send WhatsApp from the callback.
 * On ambiguous commit, the callback is NOT executed again.
 */
class MongoUnitOfWork {
  constructor({ mongoose, maxAttempts = DEFAULT_ATTEMPTS, maxCommitAttempts = DEFAULT_COMMIT_ATTEMPTS } = {}) {
    if (!mongoose || typeof mongoose.startSession !== 'function') {
      throw new TypeError('mongoose with startSession() is required');
    }
    checkAttempts(maxAttempts, 'maxAttempts');
    checkAttempts(maxCommitAttempts, 'maxCommitAttempts');
    this.mongoose = mongoose;
    this.maxAttempts = maxAttempts;
    this.maxCommitAttempts = maxCommitAttempts;
  }

  async run(work) {
    if (typeof work !== 'function') throw new TypeError('work must be a function');
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const session = await this.mongoose.startSession();
      let committed = false;
      try {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        });
        const result = await work(sessionContext(session));
        for (let commitAttempt = 1; commitAttempt <= this.maxCommitAttempts; commitAttempt++) {
          try {
            await session.commitTransaction();
            committed = true;
            return result;
          } catch (error) {
            if (hasErrorLabel(error, 'UnknownTransactionCommitResult')) {
              if (commitAttempt === this.maxCommitAttempts) {
                throw new TransactionCommitUncertainError(error);
              }
              continue; // Retry commit, never rerun work.
            }
            throw error;
          }
        }
      } catch (error) {
        if (error instanceof TransactionCommitUncertainError) throw error;
        if (hasErrorLabel(error, 'UnknownTransactionCommitResult')) {
          throw new TransactionCommitUncertainError(error);
        }
        if (hasErrorLabel(error, 'TransientTransactionError') && attempt < this.maxAttempts) {
          continue; // A new session and transaction are started next iteration.
        }
        throw error;
      } finally {
        if (!committed && session.inTransaction()) {
          try { await session.abortTransaction(); } catch (_) { /* keep original failure */ }
        }
        await session.endSession();
      }
    }
    throw new Error('Transaction retry limit exceeded');
  }
}

module.exports = { MongoUnitOfWork, TransactionCommitUncertainError, sessionContext, hasErrorLabel };
