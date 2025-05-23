process.env.NODE_ENV = 'test';

const request = require('supertest');
jest.mock('../../models/user');
jest.mock('../../models/product');
jest.mock('../../middleware/authmiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'user123' };
    next();
  },
  admin: (req, res, next) => next(),
}));

const app = require('../../index');
const User = require('../../models/user');
const Product = require('../../models/product');

describe('Wishlist Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/wishlist', () => {
    it('should return the populated wishlist', async () => {
      const populateMock = jest.fn().mockResolvedValue({ wishlist: ['pid1', 'pid2'] });
      User.findById.mockReturnValue({ populate: populateMock });

      const res = await request(app).get('/api/users/wishlist');

      expect(res.status).toBe(200);
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(populateMock).toHaveBeenCalledWith('wishlist');
      expect(res.body).toEqual(['pid1', 'pid2']);
    });

    it('should return an empty array when wishlist is empty', async () => {
      const populateMock = jest.fn().mockResolvedValue({ wishlist: [] });
      User.findById.mockReturnValue({ populate: populateMock });

      const res = await request(app).get('/api/users/wishlist');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/users/wishlist/:productId', () => {
    it('should return 404 if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      const res = await request(app).post('/api/users/wishlist/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Product not found' });
    });

    it('should add product when not already in wishlist', async () => {
      Product.findById.mockResolvedValue({});
      const saveMock = jest.fn().mockResolvedValue();
      const populateMock = jest.fn().mockResolvedValue({ wishlist: ['pidX'] });
      User.findById.mockResolvedValue({ wishlist: [], save: saveMock, populate: populateMock });

      const res = await request(app).post('/api/users/wishlist/pidX');

      expect(res.status).toBe(200);
      expect(Product.findById).toHaveBeenCalledWith('pidX');
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(saveMock).toHaveBeenCalled();
      expect(populateMock).toHaveBeenCalledWith('wishlist');
      expect(res.body).toEqual(['pidX']);
    });

    it('should not duplicate if already in wishlist', async () => {
      Product.findById.mockResolvedValue({});
      const saveMock = jest.fn();
      const populateMock = jest.fn().mockResolvedValue({ wishlist: ['pidX'] });
      User.findById.mockResolvedValue({ wishlist: ['pidX'], save: saveMock, populate: populateMock });

      const res = await request(app).post('/api/users/wishlist/pidX');

      expect(res.status).toBe(200);
      expect(saveMock).not.toHaveBeenCalled();
      expect(populateMock).toHaveBeenCalledWith('wishlist');
      expect(res.body).toEqual(['pidX']);
    });
  });

  describe('DELETE /api/users/wishlist/:productId', () => {
    it('should remove the product and return updated wishlist', async () => {
      const saveMock = jest.fn().mockResolvedValue();
      const populateMock = jest.fn().mockResolvedValue({ wishlist: ['other'] });
      User.findById.mockResolvedValue({ wishlist: ['pidY', 'other'], save: saveMock, populate: populateMock });

      const res = await request(app).delete('/api/users/wishlist/pidY');

      expect(res.status).toBe(200);
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(saveMock).toHaveBeenCalled();
      expect(populateMock).toHaveBeenCalledWith('wishlist');
      expect(res.body).toEqual(['other']);
    });
  });
});