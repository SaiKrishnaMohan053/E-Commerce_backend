const Order = require('../models/order');
const Product = require('../models/product');
const { uploadToS3, deleteFromS3 } = require('../utils/s3upload');

const addOrder = async (req, res) => {
  const { orderItems, orderMethod } = req.body;
  const address = req.body.shippingAddress?.address;

  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({
      message: 'No order items',
    });
  }
  if (!address) {
    return res.status(400).json({
      message: 'No shipping address',
    })
  }
  if (!orderMethod) {
    return res.status(400).json({
      message: 'No order method',
    })
  }

  const adjustments = [];
  for (let item of orderItems) {
    const prod = await Product.findById(item.product);
    if (!prod) {
      return res.status(404).json({
        message: `Product ${item.product} not found`,
      })
    }

    let availableStock = prod.stock;
    if (item.flavor) {
      const flavorObj = prod.flavors.find(f => f.name === item.flavor);
      availableStock = flavorObj?.stock ?? 0;
    }

    if (item.qty > availableStock) {
      adjustments.push({
        productId:    item.product,
        flavor:       item.flavor || null,
        requestedQty: item.qty,
        availableQty: availableStock
      });
      item.qty = availableStock;
    }
  }

  const finalItems = orderItems.filter(i => i.qty > 0);
  if (!finalItems.length) {
    return res.status(400).json({
      message: 'None of the requested items are in stock.',
    });
  }

  const orderItemsForDb = await Promise.all(
    finalItems.map(async (item) => {
      const prod = await Product.findById(item.product);
      let price = prod.price;
      if (item.flavor) {
        const flavorObj = prod.flavors.find(f => f.name === item.flavor);
        if (flavorObj?.price != null) price = flavorObj.price;
      }
      return {
        product: item.product,      
        name:    prod.name,             
        flavor:  item.flavor || null,
        qty:     item.qty,
        price,                     
      };
    })
  );

  const order = new Order({
    user: req.user._id,
    orderItems   : orderItemsForDb,
    shippingAddress: { address },
    orderMethod,
  });
  const createdOrder = await order.save();

  await Promise.all(
    finalItems.map(item => (async () => {
      const prod = await Product.findById(item.product);
      if (!prod) return;
      prod.soldCount = (prod.soldCount || 0) + item.qty;
      if (item.flavor) {
        const f = prod.flavors.find(fv => fv.name === item.flavor);
        if (f) {
          f.stock     = Math.max(0, (f.stock || 0) - item.qty);
          f.soldCount = (f.soldCount || 0) + item.qty;
        }
      } else {
        prod.stock = Math.max(0, (prod.stock || 0) - item.qty);
      }
      await prod.save();
    })())
  ); 

  return res.status(201).json({ order: createdOrder, adjustments });
};

const uploadInvoice = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
    })
  }

  if (!req.file) {
    return res.status(400).json({
      message: 'No file uploaded',
    })
  }

  if (order.invoiceKey) {
    try { await deleteFromS3(order.invoiceKey); } catch (e) { console.warn(e); }
  }

  const { url, key } = await uploadToS3(req.file, `invoices/${order._id}`);

  order.invoiceUrl = url;
  order.invoiceKey = key;
  await order.save();

  res.json({ message: 'Invoice uploaded', invoiceUrl: url });
};

const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({
      message: 'Order not found',
    });
  }
  order.status = status;
  await order.save();
  return res.json({ message: 'Status updated', status: order.status });
};

const getMyOrders = async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const totalOrders = await Order.countDocuments({ user: req.user._id });

  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    orders,
    page,
    totalPages: Math.ceil(totalOrders / limit),
    totalOrders,
  });
};

const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'email storeName').populate('orderItems.product', 'images name');
  if (order && order.user._id.equals(req.user._id) || req.user.isAdmin) {
    return res.json(order);
  }
  return res.status(404).json({
    message: 'Order not found',
  });
};

const getAllOrders = async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 10;
  const skip  = (page - 1) * limit;

  const totalOrders = await Order.countDocuments({});

  const orders = await Order.find({})
    .populate('user', 'id storeName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    orders,
    page,
    totalPages: Math.ceil(totalOrders / limit),
    totalOrders,
  });
};

const cancelOrder = async (req, res) => {
  const rawId = req.params.id;
  const orderId = rawId.replace(/^["']|["']$/g, "");

  const order = await Order.findById(orderId);
  if (!order) {
    returnres.status(404).json({
      message: 'Order not found',
    })
  }

  if (!order.user.equals(req.user._id) && !req.user.isAdmin) {
    return res.status(403).json({
      message: 'Not authorized to cancel this order',
    });
  }

  if (order.status !== 'Pending') {
    return res.status(400).json({
      message: 'Only Pending orders can be cancelled',
    });
  }

  await Promise.all(order.orderItems.map(async (item) => {
    const prod = await Product.findById(item.product);
    if (!prod) return;

    prod.soldCount = Math.max(0, (prod.soldCount || 0) - item.qty);

    if (item.flavor && Array.isArray(prod.flavors)) {
      const flavorObj = prod.flavors.find(f => f.name === item.flavor);
      if (flavorObj) {
        flavorObj.stock     = (flavorObj.stock || 0) + item.qty;
        flavorObj.soldCount = Math.max(0, (flavorObj.soldCount || 0) - item.qty);
      }
    } else {
      prod.stock = (prod.stock || 0) + item.qty;
    }

    await prod.save();
  }));

  order.status = 'Cancelled';
  const updated = await order.save();

  res.json({
    message: 'Order cancelled successfully',
    status: updated.status,
  });
};

module.exports = {
  addOrder,
  uploadInvoice,
  updateOrderStatus,
  getMyOrders,
  getOrderById,
  getAllOrders,
  cancelOrder,
};