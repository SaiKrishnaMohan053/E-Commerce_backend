const express = require("express");
const { getCart, addItem, updateItem, removeItem, clearCart } = require("../controllers/cartController.js");
const { protect } = require("../middleware/authmiddleware.js");
const router = express.Router();

router.get("/", protect, getCart);
router.post("/add", protect, addItem);
router.put("/update", protect, updateItem);
router.delete("/remove", protect, removeItem);
router.post("/clear", protect, clearCart);

module.exports = router;