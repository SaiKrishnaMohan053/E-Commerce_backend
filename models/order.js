const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderItems: [
    {
      name: { type: String, required: true },
      qty: { type: Number, required: true },
      flavor: { type: String },
      price: { type: Number, required: true },
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }
    }
  ],
  shippingAddress: {
    address: { type: String, required: true }
  },
  orderMethod: { type: String, required: true },
  isPaid: { type: Boolean, default: false },
  paidAt: { type: Date },
  isDelivered: { type: Boolean, default: false },
  deliveredAt: { type: Date },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Order Ready', 'Delivered', 'Pickedup', 'Cancelled'],
    default: 'Pending'
  },
  invoiceUrl: { type: String },
  invoiceKey: { type: String },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;