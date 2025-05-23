process.env.NODE_ENV = 'test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../../models/user');
jest.mock('../../middleware/authmiddleware', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'user123' };
    next();
  },
  admin: (req, res, next) => next(),
}));

const app = require('../../index');
const User = require('../../models/user');

describe('PUT /api/users/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update profile successfully when user exists', async () => {
    const saveMock = jest.fn().mockResolvedValue();
    User.findById.mockResolvedValue({ _id: 'user123', ownerName: 'OldName', save: saveMock });

    const res = await request(app)
      .put('/api/users/profile')
      .send({ ownerName: 'NewName' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile updated successfully');
    expect(User.findById).toHaveBeenCalledWith('user123');
    expect(saveMock).toHaveBeenCalled();
  });

  it('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/users/profile')
      .send({ ownerName: 'X' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  it('should return 500 on save error', async () => {
    const saveMock = jest.fn().mockRejectedValue(new Error('save error'));
    User.findById.mockResolvedValue({ _id: 'user123', save: saveMock });

    const res = await request(app)
      .put('/api/users/profile')
      .send({ ownerName: 'X' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Server error/i);
    expect(res.body.error).toBe('save error');
  });

  it('should return 500 if findById throws an unexpected error', async () => {
    User.findById.mockRejectedValue(new Error('DB crash'));

    const res = await request(app)
      .put('/api/users/profile')
      .send({ ownerName: 'Whatever' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Server error/i);
    expect(res.body.error).toBe('DB crash');
  });

  it('should succeed (200) even if no fields are provided', async () => {
    const saveMock = jest.fn().mockResolvedValue();
    User.findById.mockResolvedValue({ _id: 'user123', ownerName: 'Same', save: saveMock });

    const res = await request(app)
      .put('/api/users/profile')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile updated successfully');
    expect(saveMock).toHaveBeenCalled();
  });
});

describe('GET /api/users/profile/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user profile when found', async () => {
    const fakeUser = { _id: 'user123', ownerName: 'TestName' };
    User.findById.mockResolvedValue(fakeUser);

    const res = await request(app)
      .get('/api/users/profile/user123')
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeUser);
    expect(User.findById).toHaveBeenCalledWith('user123');
  });

  it('should return 404 if user not found', async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/users/profile/user456')
      .send();

    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  it('should return 404 if findById throws a CastError (invalid ID)', async () => {
    User.findById.mockRejectedValue(new Error('Cast to ObjectId failed'));

    const res = await request(app)
      .get('/api/users/profile/not-an-id')
      .send();

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Cast to ObjectId failed');
  });
});