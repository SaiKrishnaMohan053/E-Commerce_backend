const express = require('express');
const { getOrders, getOrderById, updateOrderStatus } = require('../controllers/orderController.js');
const { protect, admin } = require('../middleware/authmiddleware.js');

const router = express.Router();

router.route('/').get(protect, admin, getOrders);
router.route('/:id').get(protect, admin, getOrderById).put(protect, admin, updateOrderStatus);

module.exports = router;