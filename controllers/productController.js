const Product = require('../models/product.js');
const Order = require('../models/order.js');
const { uploadToS3, deleteFromS3 } = require('../utils/s3upload.js');

const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      subCategories,
      description,
      price,
      purchaseLimit,
      isDeal,
      discountType,
      discountValue,
      flavors,
      stock,
      soldCount
    } = req.body;

    let images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const s3Response = await uploadToS3(file, 'products');
        images.push(s3Response);
      }
    }

    const parsedFlavors = flavors ? JSON.parse(flavors) : [];
    const isFlavored = parsedFlavors.length > 0;

    const product = new Product({
      name,
      category: category?.toLowerCase(),
      subCategories: subCategories?.split(',').map((c) => c.trim().toLowerCase()) || [],
      description,
      price: isFlavored
        ? parsedFlavors.every(f => f.price === undefined || f.price === null)
          ? Number(price)
          : undefined
        : Number(price),
      images,
      purchaseLimit: purchaseLimit ? Number(purchaseLimit) : null,
      isDeal: isDeal === 'true' || isDeal === true,
      discountType: discountType === "" ? null : discountType,
      discountValue: discountValue ? Number(discountValue) : 0,
      flavors: parsedFlavors,
      stock: !isFlavored ? stock : undefined,
      soldCount: !isFlavored ? Number(soldCount) || 0 : undefined,
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateProductStock = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { stock, name } = req.body;

    if (name && Array.isArray(product.flavors)) {
      const index = product.flavors.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
      if (index !== -1) {
        product.flavors[index].stock = Number(stock);
        await product.save();
        return res.json(product);
      } else {
        return res.status(404).json({ message: 'Flavor not found' });
      }
    }

    if (stock !== undefined) {
      product.stock = Number(stock);
      await product.save();
      return res.json(product);
    }

    res.status(400).json({ message: 'Missing stock or name' });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateProductInfo = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: 'Product not found' });

    const {
      name,
      category,
      subCategories,
      description,
      price,
      purchaseLimit,
      isDeal,
      discountType,
      discountValue,
      flavors,
      stock,
    } = req.body;

    if (name) product.name = name;
    if (category) product.category = category.toLowerCase();
    if (subCategories)
      product.subCategories = subCategories
        .split(',')
        .map((c) => c.trim().toLowerCase());
    if (description) product.description = description;
    if (purchaseLimit !== undefined) product.purchaseLimit = purchaseLimit;
    if (isDeal !== undefined) product.isDeal = isDeal;
    if (discountType) product.discountType = discountType;
    if (discountValue !== undefined) product.discountValue = discountValue;

    if (flavors) {
      const parsedFlavors =
        typeof flavors === "string" ? JSON.parse(flavors) : flavors;
      let isIndividualPricing = false;
    
      const updatedFlavors = parsedFlavors.map(newFlavor => {
        const existing = product.flavors.find(
          (f) => f.name.toLowerCase() === newFlavor.name.toLowerCase()
        );
    
        if (newFlavor.price !== undefined) {
          isIndividualPricing = true;
        }
    
        return {
          name: newFlavor.name,
          price:
            newFlavor.price !== undefined
              ? newFlavor.price
              : existing
              ? existing.price
              : undefined,
          stock:
            newFlavor.stock !== undefined
              ? newFlavor.stock
              : existing
              ? existing.stock
              : 0,
          soldCount: existing ? existing.soldCount : 0,
        };
      });
    
      product.flavors = updatedFlavors;
    
      if (isIndividualPricing) {
        product.price = undefined;
      } else if (price !== undefined) {
        product.price = Number(price);
        product.flavors = updatedFlavors.map((f) => ({ ...f, price: undefined }));
      }
    
      product.stock = undefined;
      product.soldCount = undefined;
    } else if (price !== undefined) {
      product.price = Number(price);
      product.stock = Number(stock);
      product.flavors = [];
    }

    if (req.files && req.files.length > 0) {
      for (const image of product.images) {
        if (image.key) await deleteFromS3(image.key);
      }
      let newImages = [];
      for (const file of req.files) {
        const s3Response = await uploadToS3(file, "products");
        newImages.push(s3Response);
      }
      product.images = newImages;
    }

    const updated = await product.save();
    res.json(updated);
  } catch (err) {
    console.error("Error updating product info:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const {
      category,
      subCategories,
      isDeal,
      priceMin,
      priceMax,
      sort,
      page,
      limit,
      name,
      excludeId,
    } = req.query;

    const pageNumber = Number(page) >= 1 ? Number(page) : 1;
    const pageSize = Number(limit) > 0 ? Number(limit) : 12;

    let filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    if (category) {
      filter.category = category.trim().toLowerCase();
    }

    if (subCategories) {
      const list = subCategories.split(',').map((c) => c.trim().toLowerCase());
      filter.subCategories = { $in: list };
    }

    if (isDeal === 'true') {
      filter.isDeal = true;
    }

    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) {
        filter.price.$gte = Number(priceMin);
      }
      if (priceMax) {
        filter.price.$lte = Number(priceMax);
      }
    }

    console.log('Filter:', filter);

    let query = Product.find(filter);

    if (sort) {
      let sortOption = {};
      if (sort === 'price_asc') {
        sortOption.price = 1;
      } else if (sort === 'price_desc') {
        sortOption.price = -1;
      } else if (sort === 'newest') {
        sortOption.createdAt = -1;
      } else if (sort === 'popularity') {
        sortOption['flavors.soldCount'] = -1;
      }
      query = query.sort(sortOption);
    } else {
      query = query.sort({ name: 1 });
    }

    const total = await Product.countDocuments(filter);
    const products = await query.skip((pageNumber - 1) * pageSize).limit(pageSize);

    res.json({
      products,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      totalProducts: total,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    for (const image of product.images) {
      if (image.key) await deleteFromS3(image.key);
    }

    await product.deleteOne();
    res.json({ message: 'Product removed successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category');

    const results = await Promise.all(categories.map(async (cat) => {
      let subCategories = await Product.distinct('subCategories', { category: cat });
      subCategories = subCategories.filter(v => typeof v === 'string' && v.trim());

      const doc = await Product.findOne({ category: cat }).lean();
      let imageUrl = null;
      if (doc) {
        if (typeof doc.image === 'string' && doc.image.trim()) {
          imageUrl = doc.image;
        } else if (typeof doc.imageUrl === 'string' && doc.imageUrl.trim()) {
          imageUrl = doc.imageUrl;
        } else if (Array.isArray(doc.images) && doc.images.length > 0) {
          imageUrl = doc.images[0].url || null;
        }
      }

      return { category: cat, imageUrl, subCategories };
    }));

    return res.json(results);
  } catch (err) {
    console.error('Get categories & sub-categories error:', err);
    return res.status(500).json({ message: 'Failed to load categories' });
  }
};

const getDashboardData = async (req, res) => {
  const sellersLimit = parseInt(req.query.sellersLimit, 10) || 20;
  const dealsLimit = parseInt(req.query.dealsLimit, 10) || 20;
  const arrivalsLimit = parseInt(req.query.arrivalsLimit, 10) || 20;

  const topSellers = await Order.aggregate([
    { $match: { status: { $in: ["Order Ready","Delivered","Pickedup"] } } },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.product",
        totalQuantity: { $sum: "$orderItems.qty" },
        totalRevenue: { $sum: { $multiply: ["$orderItems.qty", "$orderItems.price"] } }
      }
    },
    { $sort: { totalRevenue: -1, totalQuantity: -1 } },
    { $limit: sellersLimit },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: "$productDetails" },
    {
      $project: {
        _id: "$productDetails._id",
        name: "$productDetails.name",
        price: "$productDetails.price",
        image: { $arrayElemAt: ["$productDetails.images", 0] },
        isDeal: "$productDetails.isDeal",
        totalQuantity: 1,
        totalRevenue: 1
      }
    }
  ]);

  const dealDocs = await Product.find({ isDeal: true })
    .sort({ createdAt: -1 })
    .limit(dealsLimit)
    .select("name price images isDeal discountType discountValue");

  const deals = dealDocs.map((prod) => ({
    _id: prod._id,
    name: prod.name,
    price: prod.price,
    image: prod.images[0],
    isDeal: prod.isDeal,
    discountType: prod.discountType,
    discountValue: prod.discountValue,
  }));

  const arrivalDocs = await Product.find()
    .sort({ createdAt: -1 })
    .limit(arrivalsLimit)
    .select("name price images isDeal");

  const newArrivals = arrivalDocs.map((prod) => ({
    _id: prod._id,
    name: prod.name,
    price: prod.price,
    image: prod.images[0],
    isDeal: prod.isDeal,
  }));

  res.json({ topSellers, deals, newArrivals });
};

module.exports = {
  createProduct,
  updateProductStock,
  updateProductInfo,
  getProducts,
  getProductById,
  deleteProduct,
  getCategories,
  getDashboardData
};