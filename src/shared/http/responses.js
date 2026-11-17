'use strict';

function success(res, { data, message, status = 200, meta } = {}) {
  if (!Number.isInteger(status) || status < 200 || status > 299 || status === 204 || status === 205) {
    throw new TypeError('success status must allow a JSON response (2xx excluding 204/205)');
  }
  const payload = { success: true, data: data === undefined ? null : data };
  if (message !== undefined) payload.message = message;
  if (meta !== undefined) payload.meta = meta;
  return res.status(status).json(payload);
}

function failure(res, { status = 500, code = 'INTERNAL_ERROR', message = 'Internal server error', details, requestId } = {}) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  if (requestId) error.requestId = requestId;
  return res.status(status).json({ success: false, error });
}

module.exports = { success, failure };
