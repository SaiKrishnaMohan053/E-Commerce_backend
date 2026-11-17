'use strict';

class ConfigurationError extends Error {
  constructor(issues) {
    super(`Invalid application configuration: ${issues.join('; ')}`);
    this.name = 'ConfigurationError';
    this.issues = issues;
  }
}

const isPlaceholder = (value) => /^(?:your_|replace_|changeme|placeholder)/i.test(value);
const hasValue = (value) => typeof value === 'string' && value.trim().length > 0 && !isPlaceholder(value.trim());

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash || value.includes('*')) return null;
    return url.origin;
  } catch (_) { return null; }
}

function resolveOrigins(env = process.env) {
  const requested = (env.FRONTEND_URL || '').split(',').map(x => x.trim()).filter(Boolean);
  if ((env.NODE_ENV || 'development') !== 'production') requested.push('http://localhost:3000');
  return [...new Set(requested.map(normalizeOrigin).filter(Boolean))];
}

function loadConfig(env = process.env) {
  const issues = [];
  const mode = env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(mode)) issues.push('NODE_ENV must be development, test, or production');

  const portText = env.PORT || '5000';
  const port = Number(portText);
  if (!/^\d+$/.test(String(portText)) || !Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push('PORT must be an integer from 1 to 65535');
  }

  const mongoUri = env.MONGO_URI?.trim();
  if (mode !== 'test') {
    if (!hasValue(mongoUri) || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
      issues.push('MONGO_URI must be a MongoDB connection string');
    }
    if (!hasValue(env.JWT_SECRET) || (mode === 'production' && env.JWT_SECRET.length < 32)) {
      issues.push('JWT_SECRET is required (32+ characters in production)');
    }
  }

  const originsInput = (env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  if (mode === 'production' && originsInput.length === 0) issues.push('FRONTEND_URL is required in production');
  if (originsInput.some(value => !normalizeOrigin(value))) issues.push('FRONTEND_URL must contain valid explicit HTTP(S) origins (comma-separated)');
  if (mode === 'production' && originsInput.some(value => !value.startsWith('https://'))) {
    issues.push('FRONTEND_URL must use HTTPS in production');
  }

  const awsKeys = ['AWS_REGION', 'AWS_S3_BUCKET_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const emailKeys = ['EMAIL_USER', 'EMAIL_PASS'];
  for (const [name, keys] of [['AWS S3', awsKeys], ['email', emailKeys]]) {
    const configured = keys.filter(key => hasValue(env[key]));
    if ((mode === 'production' || configured.length > 0) && configured.length !== keys.length) {
      issues.push(`${name} configuration requires ${keys.join(', ')}`);
    }
  }
  if (hasValue(env.AWS_REGION) && !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(env.AWS_REGION)) {
    issues.push('AWS_REGION format is invalid');
  }

  if (issues.length) throw new ConfigurationError(issues);
  return Object.freeze({
    nodeEnv: mode,
    port,
    mongoUri,
    allowedOrigins: Object.freeze(resolveOrigins(env)),
    businessTimezone: 'America/Chicago',
  });
}

module.exports = { ConfigurationError, loadConfig, resolveOrigins };
