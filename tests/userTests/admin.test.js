process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../models/user');
jest.mock('../../utils/s3upload', () => ({
  deleteFromS3: jest.fn(),
}));
jest.mock('../../utils/sendEmail', () => ({
  sendApprovalEmail: jest.fn(),
  sendDocumentRejectionEmail: jest.fn(),
}));

jest.mock('../../middleware/authmiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'uid', email: 'admin@example.com', isAdmin: true };
    next();
  },
  admin: (req, res, next) => next(),
}));

const app = require('../../index');
const User = require('../../models/user');
const { deleteFromS3 } = require('../../utils/s3upload');
const { sendApprovalEmail, sendDocumentRejectionEmail } = require('../../utils/sendEmail');

describe('Admin User Management Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return users list and unapprovedCount', async () => {
      const users = [{ _id: 'u1' }, { _id: 'u2' }];
      User.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(users) });
      User.countDocuments.mockResolvedValue(5);

      const res = await request(app)
        .get('/api/users');

      expect(res.status).toBe(200);
      expect(User.find).toHaveBeenCalled();
      expect(User.countDocuments).toHaveBeenCalledWith({ isApproved: false });
      expect(res.body).toEqual({ users, unapprovedCount: 5 });
    });

    it('should return 500 if User.find throws', async () => {
        User.find.mockImplementation(() => { throw new Error('DB find error'); });
        User.countDocuments.mockResolvedValue(0);

        const res = await request(app).get('/api/users');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'DB find error' });
    });

    it('should return 500 if countDocuments throws', async () => {
        User.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
        User.countDocuments.mockImplementation(() => { throw new Error('count error'); });

        const res = await request(app).get('/api/users');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'count error' });
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return a single user', async () => {
      const fakeUser = { _id: 'u1', ownerName: 'Test' };
      User.findById.mockResolvedValue(fakeUser);

      const res = await request(app)
        .get('/api/users/u1');

      expect(res.status).toBe(200);
      expect(User.findById).toHaveBeenCalledWith('u1');
      expect(res.body).toEqual(fakeUser);
    });

    it('should 404 when user not found', async () => {
      User.findById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/users/u9');

      expect(res.status).toBe(404);
      expect(res.body.message).toBeDefined();
    });

    it('should return 404 if findById throws', async () => {
        User.findById.mockImplementation(() => { throw new Error('findById error'); });

        const res = await request(app).get('/api/users/uX');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: 'findById error' });
    });
  });

  describe('PUT /api/users/approve/:id', () => {
    it('should approve an unapproved user', async () => {
      const saveMock = jest.fn().mockResolvedValue();
      const user = { _id: 'u1', isApproved: false, email: 'a@b.com', ownerName: 'Owner', save: saveMock };
      User.findById.mockResolvedValue(user);

      const res = await request(app)
        .put('/api/users/approve/u1');

      expect(res.status).toBe(200);
      expect(User.findById).toHaveBeenCalledWith('u1');
      expect(saveMock).toHaveBeenCalled();
      expect(sendApprovalEmail).toHaveBeenCalledWith(
        'a@b.com',
        'Owner',
        expect.any(String)
      );
      expect(res.body.message).toMatch(/approved successfully/i);
    });

    it('should return 400 if already approved', async () => {
      User.findById.mockResolvedValue({ isApproved: true });

      const res = await request(app)
        .put('/api/users/approve/u1');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already approved/i);
    });

    it('should return 500 if sendApprovalEmail throws', async () => {
        const saveMock = jest.fn().mockResolvedValue();
        User.findById.mockResolvedValue({ _id:'u1', isApproved:false, email:'e', ownerName:'O', save: saveMock });
        sendApprovalEmail.mockRejectedValue(new Error('Email error'));

        const res = await request(app).put('/api/users/approve/u1');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'Email error' });
    });

    it('should return 500 if findById throws in approve', async () => {
        User.findById.mockImplementation(() => { throw new Error('approve find error'); });

        const res = await request(app).put('/api/users/approve/u1');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'approve find error' });
    });
  });

  describe('DELETE /api/users/reject-user/:id', () => {
    it('should delete unapproved user and remove docs', async () => {
      const user = {
        _id: 'u2',
        isApproved: false,
        email: 'c@d.com',
        salesTaxLicense: { key: 'stk' },
        abcLicense: { key: 'abck' },
      };
      User.findById.mockResolvedValue(user);
      User.findByIdAndDelete = jest.fn().mockResolvedValue();

      const res = await request(app)
        .delete('/api/users/reject-user/u2')
        .send({ reason: 'bad docs' });

      expect(res.status).toBe(200);
      expect(User.findById).toHaveBeenCalledWith('u2');
      expect(deleteFromS3).toHaveBeenCalledWith('stk');
      expect(deleteFromS3).toHaveBeenCalledWith('abck');
      expect(sendDocumentRejectionEmail).toHaveBeenCalledWith('c@d.com', 'bad docs');
      expect(User.findByIdAndDelete).toHaveBeenCalledWith('u2');
      expect(res.body.message).toMatch(/User deleted/);
    });

    it('should return 400 if user is already approved', async () => {
      User.findById.mockResolvedValue({ isApproved: true });

      const res = await request(app)
        .delete('/api/users/reject-user/u1')
        .send({ reason: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot delete an approved user/i);
    });

    it('should return 500 if deleteFromS3 throws', async () => {
        User.findById.mockResolvedValue({
        _id:'u2', isApproved:false, email:'e',
        salesTaxLicense:{ key:'stk' }, abcLicense:{ key:'abck' }
        });
        deleteFromS3.mockRejectedValue(new Error('S3 error'));

        const res = await request(app)
        .delete('/api/users/reject-user/u2')
        .send({ reason: 'r' });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'S3 error' });
    });

    it('should return 500 if findByIdAndDelete throws', async () => {
        User.findById.mockResolvedValue({ _id:'u2', isApproved:false, salesTaxLicense:null, abcLicense:null });
        User.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('delete error'));

        const res = await request(app)
        .delete('/api/users/reject-user/u2')
        .send({ reason: 'r' });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'delete error' });
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user and return updated doc', async () => {
      const updated = { _id: 'u3', ownerName: 'NewOwner' };
      User.findByIdAndUpdate.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/users/u3')
        .send({ ownerName: 'NewOwner' });

      expect(res.status).toBe(200);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u3', { ownerName: 'NewOwner' }, { new: true });
      expect(res.body).toEqual(updated);
    });

    it('should 404 if user not found', async () => {
      User.findByIdAndUpdate.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/users/u9')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should return 500 if findByIdAndUpdate throws', async () => {
        User.findByIdAndUpdate.mockImplementation(() => { throw new Error('update error'); });

        const res = await request(app).put('/api/users/u3').send({ ownerName: 'X' });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'update error' });
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/users/u9');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should return 500 if findById throws in delete', async () => {
        User.findById.mockImplementation(() => { throw new Error('delete find error'); });

        const res = await request(app).delete('/api/users/u4');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: 'Server error', error: 'delete find error' });
    });

    it('should return 500 if deleteFromS3 throws', async () => {
      const user = { _id:'u5', salesTaxLicense:{key:'stk'}, abcLicense:{key:'abck'} };
      User.findById.mockResolvedValue(user);
      deleteFromS3.mockRejectedValue(new Error('S3 error'));

      const res = await request(app).delete('/api/users/u5');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Server error', error: 'S3 error' });
    });

    it('should return 500 if findByIdAndDelete throws in delete', async () => {
      const user = { _id:'u6', salesTaxLicense:null, abcLicense:null };
      User.findById.mockResolvedValue(user);
      User.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('delete op error'));

      const res = await request(app).delete('/api/users/u6');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Server error', error: 'delete op error' });
    });
  });
});