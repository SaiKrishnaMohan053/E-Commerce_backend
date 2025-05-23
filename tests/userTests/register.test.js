process.env.NODE_ENV = 'test';
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../index.js');

jest.mock('../../utils/s3upload', () => ({
  uploadToS3: jest.fn(),
}));
const { uploadToS3 } = require('../../utils/s3upload.js');

const User = require('../../models/user.js');
jest.mock('../../models/user.js');

describe('POST /api/users/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a user successfully', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'mockId' });

    uploadToS3.mockResolvedValue({
      url: 'https://mock-s3-url.com/file.pdf',
      key: 'licenses/mock.pdf',
      etag: 'mock-etag',
    });

    const res = await request(app)
      .post('/api/users/register')
      .field('ownerName', 'Test Owner')
      .field('storeName', 'Test Store')
      .field('email', 'test@example.com')
      .field('phoneNumber', '1234567890')
      .field('address', '123 Main St')
      .field('einNumber', '12-3456789')
      .attach('abcLicense', Buffer.from('abc'), 'abc.pdf')
      .attach('salesTaxLicense', Buffer.from('tax'), 'tax.pdf');

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/registered successfully/i);
    expect(uploadToS3).toHaveBeenCalledTimes(2);
    expect(User.create).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if salesTaxLicense is missing', async () => {
    const res = await request(app)
      .post('/api/users/register')
      .field('ownerName', 'Test Owner')
      .field('storeName', 'Test Store')
      .field('email', 'test@example.com')
      .field('phoneNumber', '1234567890')
      .field('address', '123 Main St')
      .field('einNumber', '12-3456789')
      .attach('abcLicense', Buffer.from('abc'), 'abc.pdf'); // no salesTaxLicense

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Sales Tax License is required/i);
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('should return 400 if user already exists', async () => {
    User.findOne.mockResolvedValue({ email: 'test@example.com' });

    const res = await request(app)
      .post('/api/users/register')
      .field('ownerName', 'Test Owner')
      .field('storeName', 'Test Store')
      .field('email', 'test@example.com')
      .field('phoneNumber', '1234567890')
      .field('address', '123 Main St')
      .field('einNumber', '12-3456789')
      .attach('abcLicense', Buffer.from('abc'), 'abc.pdf')
      .attach('salesTaxLicense', Buffer.from('tax'), 'tax.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should handle S3 upload error with 500', async () => {
    User.findOne.mockResolvedValue(null);
    uploadToS3.mockRejectedValue(new Error('S3 failure'));

    const res = await request(app)
      .post('/api/users/register')
      .field('ownerName', 'Test Owner')
      .field('storeName', 'Test Store')
      .field('email', 'test@example.com')
      .field('phoneNumber', '1234567890')
      .field('address', '123 Main St')
      .field('einNumber', '12-3456789')
      .attach('abcLicense', Buffer.from('abc'), 'abc.pdf')
      .attach('salesTaxLicense', Buffer.from('tax'), 'tax.pdf');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/server error/i);
  });

    it('should register successfully without abcLicense', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'mockId2' });

    uploadToS3.mockResolvedValue({ url: 'https://mock-s3-url.com/tax.pdf', key: 'licenses/tax.pdf', etag: 'etag2' });

    const res = await request(app)
      .post('/api/users/register')
      .field('ownerName', 'Test Owner')
      .field('storeName', 'Test Store')
      .field('email', 'test2@example.com')
      .field('phoneNumber', '0987654321')
      .field('address', '456 Main St')
      .field('einNumber', '98-7654321')
      .attach('salesTaxLicense', Buffer.from('tax'), 'tax.pdf');  // no abcLicense

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/registered successfully/i);
    expect(uploadToS3).toHaveBeenCalledTimes(1);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerName: 'Test Owner',
      email: 'test2@example.com',
      salesTaxLicense: expect.objectContaining({ url: expect.any(String) }),
    }));
  });

  it('should return 500 if User.create throws a validation error', async () => {
    User.findOne.mockResolvedValue(null);
    uploadToS3.mockResolvedValue({ url: 'url', key: 'key', etag: 'etag' });
    User.create.mockRejectedValue(new Error('ValidationError'));

    const res = await request(app)
      .post('/api/users/register')
      .field('ownerName', 'Bad Owner')
      .field('storeName', 'Bad Store')
      .field('email', 'bad@example.com')
      .field('phoneNumber', '000')
      .field('address', 'Nowhere')
      .field('einNumber', '00-0000000')
      .attach('abcLicense', Buffer.from('abc'), 'abc.pdf')
      .attach('salesTaxLicense', Buffer.from('tax'), 'tax.pdf');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/server error/i);
    expect(res.body.error).toBe('ValidationError');
  });
});