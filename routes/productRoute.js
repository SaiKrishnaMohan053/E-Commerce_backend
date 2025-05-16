const express = require('express');
const router = express.Router();
const {
  createProduct,
  updateProductInfo,
  updateProductStock,
  getProducts,
  getProductById,
  deleteProduct,
  getCategories,
  getDashboardData
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authmiddleware.js');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
router.get('/getProducts', getProducts);
router.get('/getProductById/:id', getProductById);

router.post('/addProduct', protect, admin, upload.array('files', 5), createProduct);
router.put('/editProduct/:id', protect, admin, upload.array('files', 5), updateProductInfo);
router.put('/updateStock/:id', protect, admin, updateProductStock);
router.delete('/deleteProduct/:id', protect, admin, deleteProduct);
router.get('/getCategories', getCategories);
router.get('/getDashboard', getDashboardData);

module.exports = router;