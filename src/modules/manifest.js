// Phase 1.2 architecture manifest. Not a runtime feature registry.
// Legacy routes/controllers/models remain authoritative until separately migrated.
const moduleNames = Object.freeze([
  "identity",
  "users",
  "stores",
  "catalog",
  "inventory",
  "orders",
  "fulfillment",
  "scheduling",
  "delivery",
  "payments",
  "notifications",
  "reporting"
]);

module.exports = { moduleNames };
