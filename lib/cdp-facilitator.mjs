// CDP x402 facilitator client with Ed25519 JWT auth (no SDK — keeps Vercel bundle small).
// Settling via CDP is what gets resources indexed in the x402 Bazaar.
import crypto from 'node:crypto';

const HOST = 'api.cdp.coinbase.com';
const BASE_PATH = '/platform/v2/x402';

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

export function cdpJwt(keyId, secretB64, method, path) {
  const seed = Buffer.from(secretB64, 'base64').subarray(0, 32);
  const key = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
    format: 'der', type: 'pkcs8',
  });
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'EdDSA', kid: keyId, typ: 'JWT', nonce: crypto.randomBytes(16).toString('hex') };
  const payload = { sub: keyId, iss: 'cdp', aud: ['cdp_service'], nbf: now, exp: now + 120,
    uris: [`${method} ${HOST}${path}`] };
  const signing = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${signing}.${b64url(crypto.sign(null, Buffer.from(signing), key))}`;
}

export function cdpFacilitator(keyId, secret) {
  async function call(op, body) {
    const path = `${BASE_PATH}/${op}`;
    const r = await fetch(`https://${HOST}${path}`, {
      method: op === 'supported' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json',
        Authorization: `Bearer ${cdpJwt(keyId, secret, op === 'supported' ? 'GET' : 'POST', path)}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) console.error(`[cdp-facilitator] ${op} ${r.status}`, JSON.stringify(j).slice(0, 500));
    return j;
  }
  return {
    async verify(paymentPayload, paymentRequirements) {
      return call('verify', { x402Version: 2, paymentPayload, paymentRequirements });
    },
    async settle(paymentPayload, paymentRequirements) {
      return call('settle', { x402Version: 2, paymentPayload, paymentRequirements });
    },
    supported: () => call('supported'),
  };
}
