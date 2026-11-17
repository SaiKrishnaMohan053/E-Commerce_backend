'use strict';

const express = require('express');
const request = require('supertest');
const { requestId } = require('../../src/shared/http/request-id');
const { success } = require('../../src/shared/http/responses');
const {
  AppError, ValidationError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError,
} = require('../../src/shared/http/errors');
const { notFound, errorHandler, normalizeError } = require('../../src/shared/http/error-handler');

function createApp() {
  const app = express();
  app.use(requestId);
  app.get('/api/v2/demo', (req, res) => success(res, { status: 201, data: { id: 'one' }, message: 'Created', meta: { source: 'test' } }));
  app.get('/api/v2/invalid', () => { throw new ValidationError('Invalid input', [{ field: 'quantity', code: 'MIN' }]); });
  app.get('/api/v2/secret', () => { throw new Error('password=SECRET_VALUE'); });
  app.get('/api/v2/duplicate', () => { const err = new Error('E11000 details'); err.code = 11000; throw err; });
  app.get('/api/v2/cast', () => { const err = new Error('Sensitive bad value'); err.name = 'CastError'; throw err; });
  app.get('/api/legacy', (req, res) => res.json({ message: 'legacy' }));
  app.get('/api/legacy-error', (req, res, next) => { res.status(400); next(new Error('legacy failure')); });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('Phase 1.4 HTTP contracts', () => {
  test('generates a server-owned UUID and ignores external IDs', async () => {
    const res = await request(createApp()).get('/api/legacy').set('X-Request-ID', 'untrusted');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(res.headers['x-request-id']).not.toBe('untrusted');
    expect(res.body).toEqual({ message: 'legacy' });
  });

  test('v2 success shape is stable', async () => {
    const res = await request(createApp()).get('/api/v2/demo');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { id: 'one' }, message: 'Created', meta: { source: 'test' } });
  });

  test('v2 validation provides details and correlation ID', async () => {
    const res = await request(createApp()).get('/api/v2/invalid');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: {
      code: 'VALIDATION_ERROR', message: 'Invalid input',
      details: [{ field: 'quantity', code: 'MIN' }], requestId: res.headers['x-request-id'],
    } });
  });

  test('v2 unknown route returns structured 404', async () => {
    const res = await request(createApp()).get('/api/v2/missing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('unexpected exceptions do not expose internal messages or stack', async () => {
    const res = await request(createApp()).get('/api/v2/secret');
    expect(res.status).toBe(500);
    expect(res.text).not.toContain('SECRET_VALUE');
    expect(res.text).not.toContain('stack');
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  test.each([['duplicate', 409, 'DUPLICATE_RESOURCE'], ['cast', 400, 'INVALID_IDENTIFIER']])(
    'maps persistence error %s safely', async (route, status, code) => {
      const res = await request(createApp()).get(`/api/v2/${route}`);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
    }
  );

  test('legacy error response shape stays unchanged', async () => {
    const res = await request(createApp()).get('/api/legacy-error');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('legacy failure');
    expect(res.body).not.toHaveProperty('success');
  });

  test('legacy unknown route returns 404 and legacy message', async () => {
    const res = await request(createApp()).get('/api/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Not Found/);
  });

  test('typed error constructors carry their status codes', () => {
    expect(new AppError({ status: 422, code: 'SOME_CODE', message: 'some message' }).status).toBe(422);
    expect(new NotFoundError().status).toBe(404);
    expect(new ConflictError().status).toBe(409);
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(normalizeError({ name: 'ValidationError', errors: { quantity: {} } }).code).toBe('VALIDATION_ERROR');
  });
});
