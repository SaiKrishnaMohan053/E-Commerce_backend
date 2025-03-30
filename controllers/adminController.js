const Order = require('../models/order.js');
const User = require('../models/user.js');
const Product = require('../models/product.js');

const getDashboardStats = async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalOrders = await Order.countDocuments();
  const totalSales = await Order.aggregate([{ $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }]);
  const totalProducts = await Product.countDocuments();
  res.json({ totalUsers, totalOrders, totalSales: totalSales[0]?.totalRevenue || 0, totalProducts });
};

const getSalesReport = async (req, res) => {
  const salesReport = await Order.aggregate([
    { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, totalSales: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  res.json(salesReport);
};

const getUserAnalytics = async (req, res) => {
  const userAnalytics = await User.aggregate([
    { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  res.json(userAnalytics);
};

module.exports = { getDashboardStats, getSalesReport, getUserAnalytics };