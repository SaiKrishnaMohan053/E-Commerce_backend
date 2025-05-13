const express = require("express");
const multer = require("multer");
const {
  getSalesSummary,
  getSalesSummaryByRange,
  getSalesByCategoryByPeriod,
  getTopProducts,
  getTopSpenders,
  getOrderTrends,
  getOrderStatusBreakdown
} = require("../controllers/adminController");
const { 
  createAd,
  updateAd,
  deleteAd,
  getAds
 } = require("../controllers/adPosterController");
const { protect, admin } = require("../middleware/authmiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/summary", protect, admin, getSalesSummary);
router.get("/summary/:startDate/:endDate", protect, admin, getSalesSummaryByRange);
router.get("/sales-by-category/:period/:startDate?/:endDate?", protect, admin, getSalesByCategoryByPeriod);
router.get("/top-products", protect, admin, getTopProducts);
router.get("/top-spenders", protect, admin, getTopSpenders);
router.get("/daily-order-trends", protect, admin, getOrderTrends);
router.get("/order-status-breakdown", protect, admin, getOrderStatusBreakdown);

router.post('/createAd', protect, admin, upload.single('poster'), createAd);
router.put('/updateAd/:id', protect, admin, upload.single('poster'), updateAd);
router.delete('/deleteAd/:id', protect, admin, deleteAd);
router.get('/getAds', getAds);

module.exports = router;