'use strict';

class AppError extends Error {
  constructor({ code, message, status = 500, details } = {}) {
    super(message || 'Internal server error');
    this.name = this.constructor.name;
    this.code = code || 'INTERNAL_ERROR';
    this.status = status;
    this.statusCode = status;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super({ code: 'VALIDATION_ERROR', message, status: 400, details });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({ code: 'NOT_FOUND', message, status: 404 });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super({ code: 'CONFLICT', message, status: 409 });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ code: 'UNAUTHORIZED', message, status: 401 });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super({ code: 'FORBIDDEN', message, status: 403 });
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError };
