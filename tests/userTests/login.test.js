process.env.NODE_ENV = 'test';
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = require('../../index');
const User = require('../../models/user');
jest.mock('../../models/user');
jest.mock('bcryptjs');
jest.mock('../../utils/generateToken', () => () => 'mocked-jwt-token');

describe('POST /api/users/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should login successfully with valid credentials and approved user', async () => {
    User.findOne.mockResolvedValue({
      email: 'test@example.com',
      password: 'hashed-password',
      isApproved: true,
      isAdmin: false,
      _id: 'user123',
    });

    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('mocked-jwt-token');
    expect(res.body.user).toEqual({
      isAdmin: false,
      isApproved: true,
    });
  });

  it('should return 401 if user not found', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'notfound@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('should return 403 if user is not approved', async () => {
    User.findOne.mockResolvedValue({
      email: 'test@example.com',
      password: 'hashed-password',
      isApproved: false,
    });

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not approved/i);
  });

  it('should return 401 if password is incorrect', async () => {
    User.findOne.mockResolvedValue({
      email: 'test@example.com',
      password: 'hashed-password',
      isApproved: true,
    });

    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

    it('should return 500 on DB error', async () => {
    User.findOne.mockRejectedValue(new Error('DB failure'));

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'error@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
    expect(res.body.error).toBe('DB failure');
  });

  it('should return 500 if bcrypt.compare throws', async () => {
    User.findOne.mockResolvedValue({
      email: 'test@example.com',
      password: 'hashed', 
      isApproved: true,
    });
    bcrypt.compare.mockRejectedValue(new Error('bcrypt failed'));

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
    expect(res.body.error).toBe('bcrypt failed');
  });

  it('should return 401 if email is missing', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/users/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('should return 401 if password is missing', async () => {
    User.findOne.mockResolvedValue({
      email: 'test@example.com',
      password: 'hashed',
      isApproved: true,
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });
});