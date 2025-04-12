const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  subCategories: [{ type: String }],
  description: { type: String },
  price: { type: Number },
  images: [
    {
      url: { type: String },
      key: { type: String },
      etag: { type: String },
    }
  ],
  isDeal: { type: Boolean, default: false },
  discountType: { type: String, enum: ['percent', 'fixed'], default: null },
  discountValue: { type: Number, default: 0 },
  purchaseLimit: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
  flavors: [
    {
      name: { type: String, required: true },
      price: { type: Number },
      stock: { type: Number, default: 0 },
      soldCount: { type: Number, default: 0 },
    }
  ],
  stock: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Product', productSchema);