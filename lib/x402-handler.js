// x402 payment enforcement for Vercel serverless functions
const { x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');

const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.X402_NETWORK || 'eip155:84532';
const FACILITATOR_URL = process.env.X402_FACILITATOR || 'https://x402.org/facilitator';

// Cache initialized resource server (Vercel may reuse lambda instances)
let _resourceServer = null;

async function getResourceServer() {
  if (_resourceServer) return _resourceServer;
  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
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

    if (!sigHeader && !paymentHeader) {
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
      res.status(402).json({ error: 'Payment verification failed' });
      return false;
    }

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
