'use strict';

// Dependency injection keeps database readiness independently testable.
// `listen` must return a Promise that resolves only after HTTP listening succeeds.
async function startServer({ config, connect, listen }) {
  await connect(config.mongoUri);
  return listen(config.port);
}

module.exports = { startServer };
