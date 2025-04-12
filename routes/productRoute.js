const express = require('express');
const router = express.Router();
const {
  createProduct,
  updateProductInfo,
  updateProductStock,
  getProducts,
  getProductById,
  deleteProduct,
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
router.get('/getProducts', getProducts);
router.get('/getProductById/:id', getProductById);

router.post('/addProduct', protect, admin, upload.array('files', 5), createProduct);
router.put('/editProduct/:id', protect, admin, upload.array('files', 5), updateProductInfo);
router.put('/updateStock/:id', protect, admin, updateProductStock);
router.delete('/deleteProduct/:id', protect, admin, deleteProduct);

module.exports = router;