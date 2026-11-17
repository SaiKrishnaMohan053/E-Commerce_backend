const request = require('supertest');
const { profileUpdateFields, validateUpload, UPLOAD_TYPES, MAX_UPLOAD_BYTES } = require('../../src/shared/security/policies');
const { authorizeRoles } = require('../../middleware/authmiddleware');

const respond = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

describe('Phase 1.5 self-profile field policy', () => {
  test('allows known editable contact fields', () => {
    expect(profileUpdateFields({ ownerName: '  New Owner  ', address: '  Mobile  ' }))
      .toEqual({ updates: { ownerName: 'New Owner', address: 'Mobile' } });
  });
  test.each(['isAdmin', 'isEmployee', 'isApproved', 'password', 'resetPasswordToken',
    'roles', '_id', 'salesTaxLicense', 'email', '$set', 'address.city'])('rejects privileged/path field %s', key => {
    expect(profileUpdateFields({ [key]: true }).error).toBeDefined();
  });
  test('unknown harmless legacy fields are ignored, not stored', () => {
    expect(profileUpdateFields({ unknown: 'ignored' })).toEqual({ updates: {} });
  });
  test('rejects invalid field shapes', () => {
    expect(profileUpdateFields({ ownerName: {} }).error).toBeDefined();
  });
});

describe('upload policy', () => {
  test('accepts a supported bounded file', () => {
    expect(validateUpload({ mimetype: 'image/png', size: 4, buffer: Buffer.from('1234') })).toBeNull();
  });
  test('rejects unsupported files, missing files and oversize files', () => {
    expect(validateUpload(null)).toBeTruthy();
    expect(validateUpload({ mimetype: 'text/html', size: 4, buffer: Buffer.from('1234') })).toBeTruthy();
    expect(validateUpload({ mimetype: 'image/png', size: MAX_UPLOAD_BYTES + 1, buffer: Buffer.alloc(1) })).toBeTruthy();
    expect(UPLOAD_TYPES['application/pdf']).toBe('.pdf');
  });
});

describe('role authorization middleware', () => {
  test('requires authentication', () => {
    const res = respond(), next = jest.fn();
    authorizeRoles('warehouse-worker')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  test('rejects missing role', () => {
    const res = respond(), next = jest.fn();
    authorizeRoles('warehouse-worker')({ user: { isEmployee: true } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  test('accepts matching legacy and explicit role', () => {
    const next = jest.fn();
    authorizeRoles('admin')({ user: { isAdmin: true } }, respond(), next);
    authorizeRoles('warehouse-worker')({ user: { roles: ['warehouse-worker'] } }, respond(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('protected legacy endpoints', () => {
  const app = require('../../index');
  test('unauthenticated upload cannot reach S3', async () => {
    const res = await request(app).post('/api/upload').attach('file', Buffer.from('png'), 'test.png');
    expect(res.status).toBe(401);
  });
  test('unauthenticated weekly report cannot run', async () => {
    const res = await request(app).post('/api/admin/send-weekly-inventory-report');
    expect(res.status).toBe(401);
  });
});
