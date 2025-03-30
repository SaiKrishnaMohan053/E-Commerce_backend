const express = require('express');
const { getDashboardStats, getSalesReport, getUserAnalytics } = require('../controllers/adminController.js');
const { protect, admin } = require('../middleware/authmiddleware.js');

const router = express.Router();

router.get('/dashboard-stats', protect, admin, getDashboardStats);
router.get('/sales-report', protect, admin, getSalesReport);
router.get('/user-analytics', protect, admin, getUserAnalytics);

module.exports = router;