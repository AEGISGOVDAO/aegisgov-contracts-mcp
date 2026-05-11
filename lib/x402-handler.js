// x402 payment enforcement for Vercel serverless functions (x402 v2 API)
// Supports x402.org facilitator (testnet) and Coinbase CDP facilitator (mainnet)
const { x402ResourceServer, x402HTTPResourceServer, HTTPFacilitatorClient } = require('@x402/core/server');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');
const { ExpressAdapter } = require('@x402/express');
const { logEvent } = require('./logger');

const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.X402_NETWORK || 'eip155:84532';
const FACILITATOR_URL = process.env.X402_FACILITATOR || 'https://x402.org/facilitator';
const CDP_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

// Cache initialized HTTP servers per price (Vercel may reuse lambda instances)
const _httpServers = {};

/**
 * Generate CDP auth headers using JWT for the Coinbase facilitator.
 * Uses ES256 (EC) or EdDSA depending on the key format.
 */
async function createCDPAuthHeaders(path) {
  if (!CDP_KEY_ID || !CDP_KEY_SECRET) return { headers: {} };

  try {
    // Dynamic import of jose (lightweight JWT library)
    const jose = require('jose');
    const { importPKCS8, importJWK, SignJWT } = jose;

    const host = 'api.cdp.coinbase.com';
    const method = 'POST';
    const uri = `${method} ${host}${path}`;

    const now = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString(36).slice(2);

    let privateKey;
    let alg = 'ES256';

    // Try parsing as PEM EC key first
    const secretStr = CDP_KEY_SECRET;
    if (secretStr.includes('BEGIN') || secretStr.includes('-----')) {
      privateKey = await importPKCS8(secretStr, 'ES256');
      alg = 'ES256';
    } else {
      // Try as Ed25519 base64
      try {
        const keyBytes = Buffer.from(secretStr, 'base64');
        privateKey = await importJWK({ kty: 'OKP', crv: 'Ed25519', d: keyBytes.toString('base64url'), x: '' }, 'EdDSA');
        alg = 'EdDSA';
      } catch {
        // Try as JSON JWK
        const jwk = JSON.parse(secretStr);
        privateKey = await importJWK(jwk, jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256');
        alg = jwk.crv === 'Ed25519' ? 'EdDSA' : 'ES256';
      }
    }

    const jwt = await new SignJWT({ sub: CDP_KEY_ID, iss: 'cdp', uris: [uri] })
      .setProtectedHeader({ alg, kid: CDP_KEY_ID, nonce })
      .setIssuedAt(now)
      .setExpirationTime(now + 120)
      .sign(privateKey);

    return { headers: { Authorization: `Bearer ${jwt}` } };
  } catch (e) {
    console.error('CDP auth error:', e.message);
    return { headers: {} };
  }
}

async function getHTTPServer(price, path) {
  const key = `${NETWORK}_${price}_${path}`;
  if (_httpServers[key]) return _httpServers[key];

  const routes = {
    [`POST ${path}`]: {
      scheme: 'exact',
      price,
      network: NETWORK,
      payTo: WALLET,
      description: `AegisGov Contract Intelligence API — ${price} USDC`,
    },
  };

  // Use CDP auth for mainnet, no auth for testnet
  const isCDP = FACILITATOR_URL.includes('cdp.coinbase.com');
  const facilitatorConfig = { url: FACILITATOR_URL };
  if (isCDP) {
    facilitatorConfig.createAuthHeaders = (p) => createCDPAuthHeaders(`/platform/v2/x402/${p}`);
  }

  const facilitator = new HTTPFacilitatorClient(facilitatorConfig);
  const rs = new x402ResourceServer([facilitator]);
  registerExactEvmScheme(rs);
  await rs.initialize();

  const httpServer = new x402HTTPResourceServer(rs, routes);
  _httpServers[key] = httpServer;
  return httpServer;
}

/**
 * Enforce x402 payment for a given price.
 * Returns true if payment verified / not required, or sends 402 and returns false.
 */
async function requirePayment(req, res, price) {
  const path = (req.url || '/').split('?')[0] || '/';
  const tool = path.replace(/^\//, '') || 'unknown';

  try {
    const httpServer = await getHTTPServer(price, path);
    const adapter = new ExpressAdapter(req);
    const paymentHeader =
      req.headers['payment-signature'] || req.headers['x-payment'] ||
      req.headers['Payment-Signature'] || req.headers['X-Payment'];

    const context = {
      adapter,
      path,
      method: req.method || 'POST',
      paymentHeader: paymentHeader || undefined,
    };

    const result = await httpServer.processHTTPRequest(context);

    if (result.type === 'no-payment-required' || result.type === 'payment-verified') {
      if (result.type === 'payment-verified') {
        logEvent('payment_verified', tool, { price }).catch(() => {});
      }
      return true;
    }

    if (result.type === 'payment-error') {
      logEvent('402_hit', tool, { price, ua: req.headers['user-agent'] || '' }).catch(() => {});
      const { response } = result;
      res.status(response.status || 402);
      Object.entries(response.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
      if (response.body) {
        res.json(response.body);
      } else {
        res.json({ error: 'Payment required', docs: 'https://aegisgov.ai/mcp' });
      }
      return false;
    }

    return false;
  } catch (e) {
    // Allow in dev mode if payment processing fails
    if (process.env.NODE_ENV !== 'production') return true;
    console.error('x402 error:', e.message);
    res.status(500).json({ error: 'Payment processing error', details: e.message });
    return false;
  }
}

module.exports = { requirePayment };
