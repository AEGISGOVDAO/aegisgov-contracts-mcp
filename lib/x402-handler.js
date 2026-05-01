// x402 payment enforcement for Vercel serverless functions
const { x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');
const { logEvent } = require('./logger');

const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.X402_NETWORK || 'eip155:8453';
const FACILITATOR_URL = process.env.X402_FACILITATOR || 'https://x402.org/facilitator';
const CDP_KEY_ID = process.env.CDP_API_KEY_ID;
const CDP_KEY_SECRET = process.env.CDP_API_KEY_SECRET;

// Build CDP auth headers for Coinbase facilitator (if credentials provided)
function makeCdpAuthHeaders() {
  if (!CDP_KEY_ID || !CDP_KEY_SECRET) return null;
  return async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const crypto = require('crypto');
    const secret = Buffer.from(CDP_KEY_SECRET, 'base64');
    // CDP HMAC-SHA256 auth: sign "timestamp + method + path"
    const makeSign = (path) => {
      const msg = timestamp + 'POST' + '/' + path;
      return crypto.createHmac('sha256', secret).update(msg).digest('hex');
    };
    const commonHeaders = {
      'CB-ACCESS-KEY': CDP_KEY_ID,
      'CB-ACCESS-TIMESTAMP': timestamp,
    };
    return {
      verify: { ...commonHeaders, 'CB-ACCESS-SIGN': makeSign('verify') },
      settle: { ...commonHeaders, 'CB-ACCESS-SIGN': makeSign('settle') },
      supported: { ...commonHeaders, 'CB-ACCESS-SIGN': makeSign('supported') },
    };
  };
}

// Cache initialized resource server (Vercel may reuse lambda instances)
let _resourceServer = null;

async function getResourceServer() {
  if (_resourceServer) return _resourceServer;
  const authHeadersFn = makeCdpAuthHeaders();
  const facilitatorConfig = authHeadersFn
    ? { url: FACILITATOR_URL, createAuthHeaders: authHeadersFn }
    : { url: FACILITATOR_URL };
  const facilitator = new HTTPFacilitatorClient(facilitatorConfig);
  const rs = new x402ResourceServer([facilitator]);
  registerExactEvmScheme(rs);
  await rs.initialize();
  _resourceServer = rs;
  return rs;
}

/**
 * Enforce x402 payment for a given price.
 * Returns { paid: true } if payment verified, or sends 402 response.
 */
async function requirePayment(req, res, price) {
  try {
    const rs = await getResourceServer();
    const paymentHeader = req.headers['x-payment'] || req.headers['payment'];
    const sigHeader = req.headers['payment-signature'] || req.headers['x-payment-signature'];

    // Infer tool name from URL
    const tool = (req.url || '').replace('/', '').split('?')[0] || 'unknown';

    if (!sigHeader && !paymentHeader) {
      // Log 402 hit
      logEvent('402_hit', tool, { price, ua: req.headers['user-agent'] || '' }).catch(() => {});

      // Build payment requirements and return 402
      const paymentRequirements = await rs.buildPaymentRequirements({
        accepts: [{ scheme: 'exact', price, network: NETWORK, payTo: WALLET }],
        description: `AegisGov Contract Intelligence API - ${price} USDC`,
      });

      res.status(402).json({
        error: 'Payment required',
        x402Version: 1,
        paymentRequirements,
        docs: 'https://aegisgov.ai/mcp',
      });
      return false;
    }

    // Verify payment signature
    const verified = await rs.verifyPayment({
      paymentHeader: paymentHeader || sigHeader,
      scheme: 'exact',
      network: NETWORK,
      price,
      payTo: WALLET,
    });

    if (!verified) {
      logEvent('payment_failed', tool, { price }).catch(() => {});
      res.status(402).json({ error: 'Payment verification failed' });
      return false;
    }

    logEvent('payment_verified', tool, { price }).catch(() => {});
    return true;
  } catch (e) {
    // If x402 fails (e.g., facilitator down), allow request in dev mode
    if (process.env.NODE_ENV !== 'production') return true;
    console.error('x402 error:', e.message);
    res.status(500).json({ error: 'Payment processing error', details: e.message });
    return false;
  }
}

module.exports = { requirePayment };
