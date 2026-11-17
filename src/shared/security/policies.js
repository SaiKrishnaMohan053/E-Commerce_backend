'use strict';

const PROFILE_FIELDS = Object.freeze(['ownerName', 'storeName', 'phoneNumber', 'address']);
const FORBIDDEN_PROFILE_FIELDS = new Set([
  '_id', 'id', 'email', 'einNumber', 'password', 'isAdmin', 'isEmployee', 'isApproved',
  'resetPasswordToken', 'resetPasswordExpires', 'abcLicense', 'salesTaxLicense',
  'wishlist', '__v', 'createdAt', 'updatedAt', 'roles', 'permissions'
]);
const UPLOAD_TYPES = Object.freeze({
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/gif': '.gif', 'application/pdf': '.pdf'
});
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function profileUpdateFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Profile update must be an object' };
  }
  const keys = Object.keys(body);
  if (keys.some(k => FORBIDDEN_PROFILE_FIELDS.has(k) || k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype')) {
    return { error: 'Profile contains protected or invalid fields' };
  }
  const updates = {};
  for (const key of PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 500) {
        return { error: `Invalid profile field: ${key}` };
      }
      updates[key] = body[key].trim();
    }
  }
  return { updates };
}
function validateUpload(file) {
  if (!file) return 'File is required';
  if (!Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, file.mimetype)) return 'Unsupported file type';
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_UPLOAD_BYTES) return 'Invalid file size';
  if (!Buffer.isBuffer(file.buffer)) return 'Invalid file data';
  return null;
}
module.exports = { PROFILE_FIELDS, UPLOAD_TYPES, MAX_UPLOAD_BYTES, profileUpdateFields, validateUpload };
