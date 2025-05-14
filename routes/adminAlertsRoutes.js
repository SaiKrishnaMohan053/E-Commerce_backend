const express = require('express');
const router  = express.Router();
const InventoryMetric = require('../models/inventoryMetricModel');
const { weeklyJob } = require('../controllers//inventoryMetricController');
const { protect, admin } = require('../middleware/authmiddleware');

const ALLOWED_VELOCITIES = ['Fast', 'Average', 'Slow'];

router.get('/restock-alerts', protect, admin, async (req, res) => {
  try {
    const { velocity } = req.query;

    if (velocity && !ALLOWED_VELOCITIES.includes(velocity)) {
      return res.status(400).json({ message: `Invalid velocity filter "${velocity}"` });
    }

    const metrics = await InventoryMetric.find()
    .populate('product', 'name sku category subCategories stock flavors')
    .lean();

    const entries = metrics.flatMap(doc =>
      doc.flavorMetrics
        .filter(fm => !velocity || fm.salesVelocity === velocity)
        .map(fm => {
          const flavorItem = doc.product.flavors?.find(f => f.name === fm.flavorName);
          const currentStock = (flavorItem && flavorItem.stock != null) ? flavorItem.stock: doc.product.stock;
          const isLowStock = currentStock < 5;
          return {
            product: doc.product,
            flavorName: fm.flavorName,
            avgWeeklySales: fm.avgWeeklySales,
            recommendedWeeklyStock: fm.recommendedWeeklyStock,
            reorderPoint: fm.reorderPoint,
            daysOfStockRemaining: fm.daysOfStockRemaining,
            salesVelocity: fm.salesVelocity,
            currentStock,
            isLowStock
          }
        })
    );

    entries.sort((a, b) => a.daysOfStockRemaining - b.daysOfStockRemaining);

    res.json(entries);

  } catch (err) {
    console.error('Error fetching restock alerts:', err);
    res.status(500).json({ message: 'Error fetching restock alerts', error: err.message });
  }
});

router.post('/send-weekly-inventory-report', async (req, res) => {
  try {
    await weeklyJob();
    return res.json({ message: 'Weekly inventory report sent!' });
  } catch (err) {
    console.error('Error sending weekly report:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;