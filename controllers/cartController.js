const Cart = require("../models/cart");

const getCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user.id }).populate("items.productId", "name images purchaseLimit"); 
  if (!cart) {
    cart = await Cart.create({ user: req.user.id, items: [] });
  }
  res.json(cart);
};

const addItem = async (req, res) => {
  let { productId, flavor, qty, price } = req.body;

  qty = Number(qty);
  price = Number(price);

  if (!productId || isNaN(qty) || qty < 1 || isNaN(price) || price < 0) {
    return res.status(400).json({ message: "Invalid product details in cart." });
  }

  const cart = await Cart.findOneAndUpdate(
    { user: req.user.id },
    { $setOnInsert: { user: req.user.id } },
    { upsert: true, new: true }
  );
                                         
  const idx = cart.items.findIndex(
    i => i.productId.toString() === productId && (i.flavor || "") === (flavor || "")
  );

  if (idx >= 0) {
    cart.items[idx].qty += qty;
  } else {
    cart.items.push({ productId, flavor, qty, price });
  }

  await cart.save();

  await cart.populate("items.productId", "name images purchaseLimit");
  return res.json(cart);
};

const updateItem = async (req, res) => {
  const { productId, flavor, qty } = req.body;
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const idx = cart.items.findIndex(
    i => i.productId.toString() === productId && (i.flavor||"") === (flavor||"")
  );
  if (idx === -1) return res.status(404).json({ message: "Item not in cart" });

  cart.items[idx].qty = Number(qty);
  if (cart.items[idx].qty < 1) cart.items.splice(idx, 1);
  await cart.save();

  await cart.populate("items.productId", "name images purchaseLimit");
  return res.json(cart);
};

const removeItem = async (req, res) => {
  const { productId, flavor } = req.body;
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  cart.items = cart.items.filter(
    i => !(i.productId.toString() === productId && (i.flavor||"") === (flavor||""))
  );
  await cart.save();

  await cart.populate("items.productId", "name images purchaseLimit");
  return res.json(cart);
};

const clearCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });
  cart.items = [];
  await cart.save();

  await cart.populate("items.productId", "name images purchaseLimit");
  return res.json(cart);
};

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};