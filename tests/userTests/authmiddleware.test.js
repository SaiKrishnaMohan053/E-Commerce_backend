process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const { protect, admin } = require('../../middleware/authmiddleware');

jest.mock('jsonwebtoken');
jest.mock('../../models/user');

describe('protect middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('returns 401 if no Authorization header', async () => {
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, token missing' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if token is invalid', async () => {
    req.headers.authorization = 'Bearer badtoken';
    jwt.verify.mockImplementation(() => { throw new Error('invalid'); });

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('badtoken', process.env.JWT_SECRET);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 if user not found', async () => {
    req.headers.authorization = 'Bearer goodtoken';
    jwt.verify.mockReturnValue({ id: 'uid' });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await protect(req, res, next);

    expect(User.findById).toHaveBeenCalledWith('uid');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, user does not exist' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches req.user on success', async () => {
    req.headers.authorization = 'Bearer goodtoken';
    const fakeUser = { _id: 'uid', email: 'e@e.com' };
    jwt.verify.mockReturnValue({ id: 'uid' });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });

    await protect(req, res, next);

    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 on unexpected error', async () => {
    req.headers.authorization = 'Bearer goodtoken';
    jwt.verify.mockReturnValue({ id: 'uid' });
    User.findById.mockImplementation(() => { throw new Error('oops'); });

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('admin middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('returns 401 if req.user is missing', () => {
    admin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, user not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if user.isAdmin is false', () => {
    req.user = { isAdmin: false, email: 'u@u.com' };
    admin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized as admin' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() if user.isAdmin is true', () => {
    req.user = { isAdmin: true };
    admin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});