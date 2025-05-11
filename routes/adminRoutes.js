const express = require("express");
const {
  getSalesSummary,
  getSalesSummaryByRange,
  getSalesByCategoryByPeriod,
  getTopProducts,
  getTopSpenders,
  getOrderTrends,
  getOrderStatusBreakdown
} = require("../controllers/adminController");
const { protect, admin } = require("../middleware/authmiddleware");

const router = express.Router();

router.get("/summary", protect, admin, getSalesSummary);
router.get("/summary/:startDate/:endDate", protect, admin, getSalesSummaryByRange);
router.get("/sales-by-category/:period/:startDate?/:endDate?", protect, admin, getSalesByCategoryByPeriod);
router.get("/top-products", protect, admin, getTopProducts);
router.get("/top-spenders", protect, admin, getTopSpenders);
router.get("/daily-order-trends", protect, admin, getOrderTrends);
router.get("/order-status-breakdown", protect, admin, getOrderStatusBreakdown);

module.exports = router;