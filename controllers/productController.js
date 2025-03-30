const getProducts = async (req, res) => {
    const products = await Product.find();
    res.json(products);
  };
const getProductById = async (req, res) => {
    const product = await Product.findById(req.params.id);
    res.json(product);
  };
const createProduct = async (req, res) => {
    const product = new Product(req.body);
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  };
const updateProduct = async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  };
const deleteProduct = async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product removed' });
  };

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };