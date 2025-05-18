require('dotenv').config();
const mongoose = require('mongoose');
const { subWeeks } = require('date-fns');
const ExcelJS = require('exceljs');
const cron = require('node-cron');
const Product = require('../models/product');
const Order   = require('../models/order');
const InventoryMetric = require('../models/inventoryMetricModel');
const { sendWeeklyInventoryReport } = require('../utils/sendEmail');

async function computeMetrics() {
  await mongoose.connect(process.env.MONGO_URI);

  const periodWeeks   = +process.env.PERIOD_WEEKS    || 4;
  const leadTimeDays  = +process.env.LEAD_TIME_DAYS  || 7;
  const safetyFactor  = +process.env.SAFETY_FACTOR    || 1;
  const fastPct       = +process.env.FAST_PERCENTILE || 0.75;
  const slowPct       = +process.env.SLOW_PERCENTILE || 0.25;

  const products = await Product.find({}).lean();
  const startDate = subWeeks(new Date(), periodWeeks);
  const salesAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $unwind: '$orderItems' },
    { $project: { product: '$orderItems.product', flavor: '$orderItems.flavor', qty: '$orderItems.qty' } },
    { $group: { _id: { product: '$product', flavor: '$flavor' }, totalQty: { $sum: '$qty' } } }
  ]);

  const salesMap = {};
  salesAgg.forEach(({ _id: { product, flavor }, totalQty }) => {
    const pid = product.toString();
    const fl  = flavor || null;
    salesMap[pid] = salesMap[pid] || {};
    salesMap[pid][fl] = totalQty;
  });

  const allRates = [];
  products.forEach(p => {
    const names = p.flavors?.map(f => f.name) || [null];
    names.forEach(n => {
      const q = salesMap[p._id.toString()]?.[n] || 0;
      allRates.push(q / periodWeeks);
    });
  });
  const nonZeroRates = allRates.filter(r => r > 0);

  let slowThreshold = 0, fastThreshold = 0;
  if(nonZeroRates.length) {
    nonZeroRates.sort((a, b) => a-b);
    slowThreshold = nonZeroRates[Math.floor(slowPct * nonZeroRates.length)];
    fastThreshold = nonZeroRates[Math.floor(fastPct * nonZeroRates.length)];
  }
  
  await InventoryMetric.deleteMany({});
  for (const prod of products) {
    const flavorObjs = prod.flavors?.length ? prod.flavors : [{ name: null, stock: prod.stock }];
    const flavorMetrics = flavorObjs.map(fl => {
      const flName = fl.name || null;
      const qty     = salesMap[prod._id.toString()]?.[flName] || 0;
      const avg     = qty / periodWeeks;
      const reorder = avg * (leadTimeDays / 7) * safetyFactor;
      const stock   = fl.stock ?? prod.stock;
      const rec     = avg * safetyFactor;
      const days    = avg > 0 ? (stock / avg) * 7 : Infinity;

      let salesVelocity = '';
      if(avg <= slowThreshold && avg === 0) {
        salesVelocity = 'Slow';
      } else if (avg >= fastThreshold) {
        salesVelocity = 'Fast';
      } else {
        salesVelocity = 'Average';
      }

      return {
        flavorName: flName,
        avgWeeklySales: avg,
        recommendedWeeklyStock: rec,
        reorderPoint: reorder,
        daysOfStockRemaining: days,
        salesVelocity
      };
    });

    await InventoryMetric.create({ product: prod._id, flavorMetrics });
  }  
}

if (require.main === module) {
  computeMetrics()
    .catch(err => {
      res.status(500).json({ message: 'Server error', error: err.message });
      console.error('computeMetrics failed:', err);
      process.exit(1);
    });
}

async function weeklyJob() {
  await computeMetrics();
  const metrics = await InventoryMetric.find()
  .populate('product', 'name sku flavors stock')
  .lean();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inventory');
  ws.columns = [
    { header: 'Product', key: 'product', width: 30 },
    { header: 'SKU', key: 'sku', width: 25 },
    { header: 'Flavor',  key: 'flavor',  width: 20 },
    { header: 'currentStock', key: 'currentStock', width: 12 },
    { header: 'Avg Weekly', key: 'avg',   width: 12 },
    { header: 'Reorder Pt', key: 'rp',    width: 12 },
    { header: 'Velocity',  key: 'vel',   width: 10 }
  ];
  metrics.forEach(doc => {
    doc.flavorMetrics.forEach(fm => {
      const flavorObj = doc.product.flavors?.find(f => f.name === fm.flavorName);
      const currentStock = (flavorObj?.stock != null) ? flavorObj.stock : doc.product.stock;
      ws.addRow({
        product: doc.product.name,
        sku:     doc.product.sku || 'N/A',
        flavor:  fm.flavorName || 'N/A',
        currentStock,
        avg:     Math.round(fm.avgWeeklySales),
        rp:      Math.round(fm.reorderPoint),
        vel:     fm.salesVelocity
      });
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  await sendWeeklyInventoryReport(buffer);
}

cron.schedule('0 2 * * 6', () => {
  console.log('Running weekly inventory email job…');
  weeklyJob().catch(console.error);
});

module.exports = { computeMetrics, weeklyJob };