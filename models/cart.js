const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  flavor:     { type: String },
  qty:        { type: Number, required: true, min: 1 },
  price:      { type: Number, required: true, min: 0 },
}, { _id: false });

const CartSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  items: [CartItemSchema],
}, { timestamps: true });

module.exports = mongoose.model("Cart", CartSchema);