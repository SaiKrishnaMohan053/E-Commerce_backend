const mongoose = require('mongoose');

const flavorMetricSchema = new mongoose.Schema({
  flavorName: { type: String, default: null },
  avgWeeklySales: { type: Number, required: true },
  recommendedWeeklyStock: { type: Number, required: true },
  reorderPoint: { type: Number, required: true },
  daysOfStockRemaining: { type: Number, required: true },
  salesVelocity: { type: String, enum: ['Fast', 'Average', 'Slow'], required: true }
});

const inventoryMetricSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  flavorMetrics: {
    type: [flavorMetricSchema],
    required: true,
    validate: [arr => arr.length > 0, 'At least one flavor metric is required']
  },
  computedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('InventoryMetric', inventoryMetricSchema);