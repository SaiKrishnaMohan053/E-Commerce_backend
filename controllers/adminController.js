const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product");

const getSalesSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now).setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [daily, weekly, monthly, yearly] = await Promise.all([
      getSalesSince(new Date(startOfDay)),
      getSalesSince(new Date(startOfWeek)),
      getSalesSince(startOfMonth),
      getSalesSince(startOfYear),
    ]);

    const totalUsers = await User.countDocuments({ isApproved: true, isAdmin: false });
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await getSalesSince(new Date(0)); // all-time

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue,
      sales: { daily, weekly, monthly, yearly },
    });
  } catch (err) {
    console.error("Sales Summary Error:", err);
    res.status(500).json({ message: "Failed to fetch sales summary." });
  }
};

const getSalesSummaryByRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      createdAt: { $gte: from, $lte: to },
      status:    { $in: ["Order Ready","Delivered","Pickedup"] }
    });

    const totalSales = orders.reduce(
      (sum, order) =>
        sum + order.orderItems.reduce((acc, i) => acc + i.price * i.qty, 0),
      0
    );

    return res.json({
      from: from.toISOString().split('T')[0],
      to:   to.toISOString().split('T')[0],
      totalSales
    });
  } catch (err) {
    console.error("Custom Sales Summary Error:", err);
    res.status(500).json({ message: "Failed to fetch custom sales summary." });
  }
};

const getSalesByCategoryByPeriod = async (req, res) => {
  try {
    const { period, startDate, endDate } = req.params;

    let fromDate, toDateExclusive;

    if (startDate && endDate) {
      fromDate = new Date(startDate);
      toDateExclusive = new Date(endDate);
      toDateExclusive.setDate(toDateExclusive.getDate() + 1);
    } else {
      const now = new Date();
      switch (period) {
        case "today":
          fromDate = new Date(now.setHours(0, 0, 0, 0));
          toDateExclusive = new Date(fromDate);
          toDateExclusive.setDate(toDateExclusive.getDate() + 1);
          break;
        case "weekly":
          fromDate = new Date(now);
          fromDate.setDate(now.getDate() - now.getDay());
          fromDate.setHours(0, 0, 0, 0);
          toDateExclusive = new Date();
          toDateExclusive.setHours(0, 0, 0, 0);
          toDateExclusive.setDate(toDateExclusive.getDate() + 1);
          break;
        case "monthly":
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
          toDateExclusive = new Date(now);
          toDateExclusive.setHours(0, 0, 0, 0);
          toDateExclusive.setDate(toDateExclusive.getDate() + 1);
          break;
        case "yearly":
          fromDate = new Date(now.getFullYear(), 0, 1);
          toDateExclusive = new Date(now);
          toDateExclusive.setHours(0, 0, 0, 0);
          toDateExclusive.setDate(toDateExclusive.getDate() + 1);
          break;
        default:
          return res.status(400).json({ message: "Invalid period or missing custom dates." });
      }
    }

    const salesByCategory = await Order.aggregate([
      {
        $match: {
          status: { $in: ["Order Ready", "Delivered", "Pickedup"] },
          createdAt: { $gte: fromDate, $lte: toDateExclusive },
        },
      },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category",
          totalRevenue: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] },
          },
        },
      },
      {
        $project: {
          category: "$_id",
          totalRevenue: 1,
          _id: 0,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json(salesByCategory);
  } catch (error) {
    console.error("Sales By Category Error:", error);
    res.status(500).json({ message: "Failed to fetch sales by category." });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      { $match: { status: { $in: ["Order Ready","Delivered","Pickedup"] } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          totalSold:     { $sum: "$orderItems.qty"         },  // units
          totalRevenue:  { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from:         "products",
          localField:   "_id",
          foreignField: "_id",
          as:           "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          name:         "$productInfo.name",
          totalSold:    1,
          totalRevenue: 1
        }
      }
    ]);    

    res.json(topProducts);
  } catch (err) {
    console.error("Top Products Error:", err);
    res.status(500).json({ message: "Failed to fetch top products." });
  }
};

const getTopSpenders = async (req, res) => {
  try {
    const topSpenders = await Order.aggregate([
      { $match: { status: { $in: ["Order Ready", "Delivered", "Pickedup"] } } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      { $project: { name: "$userInfo.storeName", totalSpent: 1 } },
    ]);

    res.json(topSpenders);
  } catch (err) {
    console.error("Top Spenders Error:", err);
    res.status(500).json({ message: "Failed to fetch top spenders." });
  }
};

const getOrderTrends = async (req, res) => {
  try {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, weekly, monthly] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    return res.json({ daily, weekly, monthly });
  } catch (err) {
    console.error("Order Trends Error:", err);
    res.status(500).json({ message: "Failed to fetch order trends." });
  }
};

const getOrderStatusBreakdown = async (req, res) => {
  try {
    const breakdown = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1
        }
      }
    ]);

    res.json(breakdown);
  } catch (err) {
    console.error("Order Status Breakdown Error:", err);
    res.status(500).json({ message: "Failed to fetch order status breakdown." });
  }
};

const getSalesSince = async (startDate) => {
  const orders = await Order.find({
    createdAt: { $gte: startDate },
    status: { $in: ["Order Ready", "Delivered", "Pickedup"] },
  });

  return orders.reduce(
    (sum, order) => sum + order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0),
    0
  );
};

module.exports = {
  getSalesSummary,
  getSalesSummaryByRange,
  getSalesByCategoryByPeriod,
  getTopProducts,
  getTopSpenders,
  getOrderTrends,
  getOrderStatusBreakdown
};