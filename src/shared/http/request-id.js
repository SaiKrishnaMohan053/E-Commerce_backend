'use strict';

const { randomUUID } = require('node:crypto');

function requestId(req, res, next) {
  // Generate our own identifier. Do not trust a supplied X-Request-ID as authoritative.
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

module.exports = { requestId };
