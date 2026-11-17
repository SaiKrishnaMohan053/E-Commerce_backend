'use strict';
const { createLogger, format, transports } = require('winston');

// Render-compatible stdout/stderr logging; avoid tracked runtime log files.
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const fields = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message}${fields}`;
    }),
  ),
  transports: [new transports.Console()],
});
module.exports = logger;
