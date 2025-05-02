const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  addOrder,
  uploadInvoice,
  updateOrderStatus,
  getMyOrders,
  getOrderById,
  getAllOrders,
  cancelOrder,
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authmiddleware');
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/addOrder', protect, addOrder);
router.post('/uploadInvoice/:id/invoice', protect, admin, upload.single('invoice'), uploadInvoice);
router.patch('/updateOrderStatus/:id/status', protect, admin, updateOrderStatus);
router.get('/getOrders', protect, admin, getAllOrders);
router.get('/getMyOrders', protect, getMyOrders);
router.get('/getOrderById/:id', protect, getOrderById);
router.patch('/cancelOrder/:id', protect, cancelOrder);

module.exports = router;