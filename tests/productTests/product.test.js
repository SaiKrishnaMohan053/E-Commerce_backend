process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../index');
const Product = require('../../models/product');
const { uploadToS3, deleteFromS3 } = require('../../utils/s3upload');

jest.mock('../../models/product');
jest.mock('../../utils/s3upload', () => ({
  uploadToS3: jest.fn().mockResolvedValue({ url: 'mock', key: 'mock', etag: 'mock' }),
  deleteFromS3: jest.fn().mockResolvedValue(),
}));

jest.mock('../../middleware/authmiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'adminid', isAdmin: true };
    next();
  },
  admin: (req, res, next) => next(),
}));

describe('Product Controller Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/products/addProduct', () => {
    it('should add product with files', async () => {
      uploadToS3.mockResolvedValue({ url: 'mock-url', key: 'mock-key', etag: 'etag' });
      Product.prototype.save = jest.fn().mockResolvedValue({
        _id: 'prod1', name: 'P', images: [{ url: 'mock-url' }]
      });

      const res = await request(app)
        .post('/api/products/addProduct')
        .field('name', 'Test')
        .field('category', 'cat')
        .field('price', 10)
        .field('description', 'desc')
        .attach('files', Buffer.from('abc'), 'img1.jpg');

      expect(res.status).toBe(201);
      expect(res.body._id).toBe('prod1');
      expect(uploadToS3).toHaveBeenCalled();
      expect(Product.prototype.save).toHaveBeenCalled();
    });

    it('should handle S3 upload error', async () => {
      uploadToS3.mockRejectedValue(new Error('S3 fail'));
      Product.prototype.save = jest.fn();

      const res = await request(app)
        .post('/api/products/addProduct')
        .field('name', 'Test')
        .field('category', 'cat')
        .field('price', '10')
        .field('description', 'desc')
        .attach('files', Buffer.from('abc'), 'img1.jpg');

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/server error/i);
      expect(res.body.error).toBe('S3 fail');
    });

    it('should return 400 if name is missing', async () => {
        const res = await request(app)
            .post('/api/products/addProduct')
            .field('category', 'test-category')
            .field('description', 'Test description')
            .field('price', '10');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Name is required/i);
    });

    it('should return 400 if product with same SKU exists', async () => {
        Product.prototype.save = jest.fn().mockRejectedValue({
            code: 11000,
            keyPattern: { sku: 1 }
        });

        const res = await request(app)
            .post('/api/products/addProduct')
            .field('name', 'Unique Product')
            .field('category', 'category')
            .field('description', 'desc')
            .field('price', '10');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/sku already exists/i);
    });

    it('should create product with flavors', async () => {
        Product.prototype.save = jest.fn().mockResolvedValue({
            name: 'Flavored Product',
            flavors: [{ name: 'Mango', price: 10, stock: 5 }]
        });
        const res = await request(app)
            .post('/api/products/addProduct')
            .field('name', 'Flavored Product')
            .field('category', 'Flavored')
            .field('description', 'A product with flavors')
            .field('price', 10)
            .field('flavors', JSON.stringify([{ name: 'Mango', price: 10, stock: 5 }]));
        expect(res.status).toBe(201);
        expect(res.body.flavors[0].name).toBe('Mango');
    });
  });

  describe('PUT /api/products/editProduct/:id', () => {
    it('should update product info', async () => {
      const saveMock = jest.fn().mockResolvedValue({ _id: 'pid', name: 'Edited' });
      Product.findById.mockResolvedValue({
        _id: 'pid',
        name: 'Old',
        images: [],
        flavors: [],
        save: saveMock
      });

      const res = await request(app)
        .put('/api/products/editProduct/pid')
        .send({ name: 'Edited', price: 15 });

      expect(res.status).toBe(200);
      expect(saveMock).toHaveBeenCalled();
      expect(res.body.name).toBe('Edited');
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/products/editProduct/badid')
        .send({ name: 'Any' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/product not found/i);
    });

    it('should return 404 for invalid product ID', async () => {
        Product.findById.mockRejectedValue(new Error('Cast to ObjectId failed'));
        const res = await request(app)
            .put('/api/products/editProduct/invalidID')
            .send({ name: 'Edit Name' });
        expect(res.status).toBe(404);
    });

    it('should update only price', async () => {
        const saveMock = jest.fn().mockResolvedValue({ _id: 'pid', price: 99 });
        Product.findById.mockResolvedValue({ price: 50, save: saveMock });
        const res = await request(app)
            .put('/api/products/editProduct/pid')
            .send({ price: 99 });
        expect(res.status).toBe(200);
        expect(saveMock).toHaveBeenCalled();
        expect(res.body.price).toBe(99);
    });

    it('should delete old images and add new ones', async () => {
        uploadToS3.mockResolvedValue({ url: 'mock', key: 'newKey', etag: 'mock' });
        deleteFromS3.mockResolvedValue();
        const productMock = { images: [{ key: 'oldKey' }], save: jest.fn().mockResolvedValue({ images: [{ url: 'mock' }] }) };
        Product.findById.mockResolvedValue(productMock);

        const res = await request(app)
            .put('/api/products/editProduct/pid')
            .attach('files', Buffer.from('img'), 'newimg.jpg');

        expect(deleteFromS3).toHaveBeenCalledWith('oldKey');
        expect(uploadToS3).toHaveBeenCalled();
        expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/products/updateStock/:id', () => {
    it('should update product stock (non-flavored)', async () => {
      const saveMock = jest.fn().mockResolvedValue({ _id: 'pid', stock: 100 });
      Product.findById.mockResolvedValue({
        _id: 'pid', stock: 10, save: saveMock
      });

      const res = await request(app)
        .put('/api/products/updateStock/pid')
        .send({ stock: 100 });

      expect(res.status).toBe(200);
      expect(saveMock).toHaveBeenCalled();
      expect(res.body.stock).toBe(100);
    });

    it('should update flavor stock if flavor name provided', async () => {
      const saveMock = jest.fn().mockResolvedValue({ _id: 'pid', flavors: [{ name: 'Mango', stock: 5 }] });
      Product.findById.mockResolvedValue({
        _id: 'pid',
        flavors: [{ name: 'Mango', stock: 1 }, { name: 'Grape', stock: 2 }],
        save: saveMock
      });

      const res = await request(app)
        .put('/api/products/updateStock/pid')
        .send({ name: 'Mango', stock: 5 });

      expect(res.status).toBe(200);
      expect(saveMock).toHaveBeenCalled();
      expect(res.body.flavors[0].stock).toBe(5);
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/products/updateStock/badid')
        .send({ stock: 10 });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/product not found/i);
    });

    it('should return 404 if flavor not found', async () => {
        Product.findById.mockResolvedValue({
            flavors: [{ name: 'Lemon', stock: 5 }],
            save: jest.fn(),
        });
        const res = await request(app)
            .put('/api/products/updateStock/pid')
            .send({ name: 'Mango', stock: 10 });
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/flavor not found/i);
    });

    it('should return 400 if missing stock or name', async () => {
        Product.findById.mockResolvedValue({ save: jest.fn() });
        const res = await request(app)
            .put('/api/products/updateStock/pid')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/missing stock or name/i);
    });
  });

  describe('DELETE /api/products/deleteProduct/:id', () => {
    it('should delete product and images from S3', async () => {
      deleteFromS3.mockResolvedValue();
      const deleteOne = jest.fn().mockResolvedValue();
      Product.findById.mockResolvedValue({
        _id: 'pid',
        images: [{ key: 'imgkey' }],
        deleteOne
      });

      const res = await request(app)
        .delete('/api/products/deleteProduct/pid');

      expect(res.status).toBe(200);
      expect(deleteFromS3).toHaveBeenCalledWith('imgkey');
      expect(deleteOne).toHaveBeenCalled();
      expect(res.body.message).toMatch(/removed successfully/i);
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/products/deleteProduct/badid');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/product not found/i);
    });

    it('should handle S3 delete error gracefully', async () => {
      deleteFromS3.mockRejectedValue(new Error('S3 problem'));
      const deleteOne = jest.fn().mockResolvedValue();
      Product.findById.mockResolvedValue({
        _id: 'pid',
        images: [{ key: 'imgkey' }],
        deleteOne
      });

      const res = await request(app)
        .delete('/api/products/deleteProduct/pid');

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/server error/i);
      expect(res.body.error).toBe('S3 problem');
    });

    it('should return 404 if product does not exist', async () => {
        Product.findById.mockResolvedValue(null);
        const res = await request(app)
            .delete('/api/products/deleteProduct/pid');
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/product not found/i);
    });

    it('should delete product with no images', async () => {
        const deleteOneMock = jest.fn();
        Product.findById.mockResolvedValue({ images: [], deleteOne: deleteOneMock });
        const res = await request(app)
            .delete('/api/products/deleteProduct/pid');
        expect(res.status).toBe(200);
        expect(deleteOneMock).toHaveBeenCalled();
        expect(res.body.message).toMatch(/removed successfully/i);
    });
  });
});