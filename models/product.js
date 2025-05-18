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
  sku: {
    type: String,
    unique: true,
    trim: true,
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },  
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

productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  if (!this.sku) {
    const prefix = this.name.toUpperCase().slice(0, 3);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    this.sku = `${prefix}-${date}-${random}`;
  }

  next();
});

module.exports = mongoose.model('Product', productSchema);