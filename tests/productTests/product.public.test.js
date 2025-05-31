process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../index');
const Product = require('../../models/product');
const Order = require('../../models/order');

jest.mock('../../models/product');
jest.mock('../../models/order');

describe('Product Public Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/products/getProducts', () => {
    it('should return list of products', async () => {
      Product.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { _id: 'prod1', name: 'A' }, 
          { _id: 'prod2', name: 'B' }
        ])
      });
      Product.countDocuments.mockResolvedValue(2);

      const res = await request(app).get('/api/products/getProducts');

      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(2);
      expect(res.body.totalProducts).toBe(2);
    });

    it('should filter products by category', async () => {
        Product.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([{ name: 'C', category: 'snacks' }])
        });
        Product.countDocuments.mockResolvedValue(1);

        const res = await request(app)
            .get('/api/products/getProducts')
            .query({ category: 'snacks' });

        expect(res.status).toBe(200);
        expect(res.body.products[0].category).toBe('snacks');
    });

    it('should return paginated products', async () => {
        Product.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([{}, {}, {}])
        });
        Product.countDocuments.mockResolvedValue(15);

        const res = await request(app)
            .get('/api/products/getProducts')
            .query({ page: 2, limit: 3 });

        expect(res.status).toBe(200);
        expect(res.body.products.length).toBe(3);
        expect(res.body.page).toBe(2);
        expect(res.body.totalPages).toBeGreaterThan(0);
    });

    it('should exclude a specific product by ID', async () => {
        Product.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([{ _id: '123' }])
        });
        Product.countDocuments.mockResolvedValue(1);

        const res = await request(app)
            .get('/api/products/getProducts')
            .query({ excludeId: '999' });

        expect(res.status).toBe(200);
        expect(res.body.products[0]._id).toBe('123');
    });
  });

  describe('GET /api/products/getProductById/:id', () => {
    it('should return a product by ID', async () => {
      Product.findById.mockResolvedValue({ _id: 'pid', name: 'Test' });

      const res = await request(app).get('/api/products/getProductById/pid');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test');
    });

    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/products/getProductById/doesnotexist');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should return 404 for invalid ObjectId', async () => {
        Product.findById.mockRejectedValue(new Error('Cast to ObjectId failed'));
        const res = await request(app).get('/api/products/getProductById/invalidId');
        expect(res.status).toBe(500);
    });
  });

  describe('GET /api/products/getCategories', () => {
    it('should return categories with images and subCategories', async () => {
      Product.distinct.mockImplementation((field) => {
        if (field === 'category') return Promise.resolve(['cat1', 'cat2']);
        if (field === 'subCategories') return Promise.resolve(['sub1', 'sub2']);
        return Promise.resolve([]);
      });
      Product.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
            images: [{ url: 'imgurl' }]
        })
      });

      const res = await request(app).get('/api/products/getCategories');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('category');
      expect(res.body[0]).toHaveProperty('imageUrl');
      expect(res.body[0]).toHaveProperty('subCategories');
    });

    it('should return empty array if no categories', async () => {
        Product.distinct.mockResolvedValueOnce([]);
        const res = await request(app).get('/api/products/getCategories');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('should handle category with no images', async () => {
        Product.distinct.mockImplementation(field =>
            field === 'category' ? Promise.resolve(['cat1']) :
            field === 'subCategories' ? Promise.resolve([]) : Promise.resolve([])
        );
        Product.findOne.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ images: [] })
        });

        const res = await request(app).get('/api/products/getCategories');
        expect(res.status).toBe(200);
        expect(res.body[0].imageUrl).toBe(null);
    });

    it('should handle DB error gracefully', async () => {
        Product.distinct.mockRejectedValue(new Error('DB error'));
        const res = await request(app).get('/api/products/getCategories');
        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/Failed to load categories/i);
    });
  });

  describe('GET /api/products/getDashboard', () => {
    it('should return topSellers, deals, and newArrivals', async () => {
      Order.aggregate.mockResolvedValue([
        { _id: 'prod1', name: 'Seller1', totalQuantity: 10, totalRevenue: 200 }
      ]);
      Product.find.mockImplementation((query) => {
        if (query && query.isDeal === true) {
          return { sort: () => ({ limit: () => ({ select: () => [
            { _id: 'd1', name: 'Deal', images: [{ url: 'dealimg' }], isDeal: true }
          ]})})};
        }
        return { sort: () => ({ limit: () => ({ select: () => [
          { _id: 'n1', name: 'Arrival', images: [{ url: 'arrimg' }], isDeal: false }
        ]})})};
      });

      const res = await request(app).get('/api/products/getDashboard');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('topSellers');
      expect(res.body).toHaveProperty('deals');
      expect(res.body).toHaveProperty('newArrivals');
    });

    it('should return empty arrays if no dashboard data', async () => {
        Order.aggregate.mockResolvedValue([]);
        Product.find.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue([])
        });

        const res = await request(app).get('/api/products/getDashboard');
        expect(res.status).toBe(200);
        expect(res.body.topSellers).toEqual([]);
        expect(res.body.deals).toEqual([]);
        expect(res.body.newArrivals).toEqual([]);
    });
  });
});