process.env.NODE_ENV = 'test';
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../index');
const User = require('../../models/user');
const { sendResetPasswordEmail } = require('../../utils/sendEmail');

jest.mock('../../models/user');
jest.mock('../../utils/sendEmail');
jest.mock('bcryptjs');

describe('Forgot & Reset Password API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/users/forgot-password', () => {
    it('should send reset email for approved user', async () => {
      const mockUser = {
        email: 'approved@example.com',
        isApproved: true,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'approved@example.com' });

      expect(res.status).toBe(200);
      expect(sendResetPasswordEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String)
      );
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 404 if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'notfound@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/user not found/i);
    });

    it('should return 403 if user is not approved', async () => {
      const mockUser = { isApproved: false };
      User.findOne.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'unapproved@example.com' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not approved/i);
    });

    it('should return 500 on DB error', async () => {
      User.findOne.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'faildb@example.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
      expect(res.body.error).toBe('DB failure');
    });

    it('should return 500 if sendResetPasswordEmail throws', async () => {
      const mockUser = {
        email: 'error@example.com',
        isApproved: true,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);
      sendResetPasswordEmail.mockRejectedValue(new Error('Email service down'));

      const res = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 'error@example.com' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
      expect(res.body.error).toBe('Email service down');
    });
  });

  describe('POST /api/users/reset-password', () => {
    it('should reset password with valid token', async () => {
      const mockUser = {
        resetPasswordToken: 'validtoken',
        resetPasswordExpires: Date.now() + 3600000,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed-password');

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ resetToken: 'validtoken', newPassword: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/password reset successful/i);
      expect(mockUser.password).toBe('hashed-password');
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 400 for invalid or expired token', async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ resetToken: 'invalidtoken', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or expired token/i);
    });

    it('should return 500 on DB error', async () => {
      User.findOne.mockImplementation(() => { throw new Error('DB crash'); });

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ resetToken: 'any', newPassword: 'pw' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
      expect(res.body.error).toBe('DB crash');
    });

    it('should return 500 if bcrypt.hash throws', async () => {
      const mockUser = {
        resetPasswordToken: 'token123',
        resetPasswordExpires: Date.now() + 10000,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.hash.mockRejectedValue(new Error('Hash failure'));

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ resetToken: 'token123', newPassword: 'pw' });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
      expect(res.body.error).toBe('Hash failure');
    });

    it('should clear resetToken fields on success', async () => {
      const mockUser = {
        resetPasswordToken: 'goodtok',
        resetPasswordExpires: Date.now() + 10000,
        save: jest.fn(),
      };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed123');

      const res = await request(app)
        .post('/api/users/reset-password')
        .send({ resetToken: 'goodtok', newPassword: 'newpass' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/password reset successful/i);
      expect(mockUser.resetPasswordToken).toBeUndefined();
      expect(mockUser.resetPasswordExpires).toBeUndefined();
      expect(mockUser.password).toBe('hashed123');
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});