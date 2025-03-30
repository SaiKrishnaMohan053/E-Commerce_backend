const getOrders = async (req, res) => {
    const orders = await Order.find().populate('user', 'name email');
    res.json(orders);
  };
const getOrderById = async (req, res) => {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    res.json(order);
  };
const updateOrderStatus = async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      order.isDelivered = req.body.isDelivered;
      order.deliveredAt = Date.now();
      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  };

module.exports = { getOrders, getOrderById, updateOrderStatus };