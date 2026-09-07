// lib/apikey.js — Stateless HMAC-signed API keys
// No database required. Keys are self-contained signed JWTs.
// Format: ak_<base64url(payload)>.<base64url(hmac-sha256)>

'use strict';
const crypto = require('crypto');

function _secret() {
  const s = process.env.API_SIGNING_SECRET;
  if (!s) throw new Error('API_SIGNING_SECRET not set');
  return s;
}

/**
 * Generate a signed API key.
 * @param {string} email - Customer email from Stripe
 * @param {string} plan  - e.g. 'contracts-mcp'
 * @param {number} daysValid - How long key is valid
 * @returns {string} API key string starting with ak_
 */
function generateKey(email, plan = 'contracts-mcp', daysValid = 30) {
  const payload = {
    email,
    plan,
    issued: Date.now(),
    expires: Date.now() + daysValid * 24 * 3600 * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', _secret()).update(data).digest('base64url');
  return `ak_${data}.${sig}`;
}

/**
 * Verify an API key. Returns payload if valid, null if invalid/expired.
 * @param {string} key
 * @returns {object|null}
 */
function verifyKey(key) {
  if (!key || !key.startsWith('ak_')) return null;
  try {
    const rest = key.slice(3);
    const dot = rest.lastIndexOf('.');
    if (dot === -1) return null;
    const data = rest.slice(0, dot);
    const sig = rest.slice(dot + 1);
    const expected = crypto.createHmac('sha256', _secret()).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.expires) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract API key from request headers.
 * Checks: Authorization: Bearer ak_..., X-API-Key: ak_...
 */
function extractKey(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ak_')) return auth.slice(7);
  const xkey = req.headers['x-api-key'] || '';
  if (xkey.startsWith('ak_')) return xkey;
  return null;
}

module.exports = { generateKey, verifyKey, extractKey };
