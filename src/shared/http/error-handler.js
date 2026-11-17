'use strict';

const { AppError, NotFoundError } = require('./errors');
const { failure } = require('./responses');

const isV2 = req => req.path === '/api/v2' || req.path.startsWith('/api/v2/');
const isValidStatus = status => Number.isInteger(status) && status >= 400 && status <= 599;

function normalizeError(error) {
  if (error instanceof AppError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details };
  }
  // Do not disclose database input values, raw stack traces or internal exception text.
  if (error?.name === 'ValidationError' && error?.errors) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Validation failed' };
  }
  if (error?.name === 'CastError') {
    return { status: 400, code: 'INVALID_IDENTIFIER', message: 'Invalid identifier' };
  }
  if (error?.code === 11000) {
    return { status: 409, code: 'DUPLICATE_RESOURCE', message: 'Resource already exists' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

function notFound(req, res, next) {
  if (isV2(req)) return next(new NotFoundError('Route not found'));
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  return next(error);
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (isV2(req)) {
    const normalized = normalizeError(err);
    return failure(res, { ...normalized, requestId: req.requestId });
  }
  // Preserve old response contract on /api/* until the frontend is migrated.
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  return res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
}

module.exports = { isV2, normalizeError, notFound, errorHandler, isValidStatus };
