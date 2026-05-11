// x402 payment enforcement for Vercel serverless functions (x402 v2 API)
const { x402ResourceServer, x402HTTPResourceServer, HTTPFacilitatorClient } = require('@x402/core/server');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');
const { logEvent } = require('./logger');

const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.X402_NETWORK || 'eip155:84532';
const FACILITATOR_URL = process.env.X402_FACILITATOR || 'https://x402.org/facilitator';

// Cache initialized HTTP servers per price (Vercel may reuse lambda instances)
const _httpServers = {};

/**
 * Custom HTTP adapter for Vercel/Node.js IncomingMessage (no Express dependency).
 * Implements the HTTPAdapter interface expected by x402HTTPResourceServer.
 */
class VercelAdapter {
  constructor(req) {
    this.req = req;
  }
  getHeader(name) {
    const v = this.req.headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  }
  getMethod() {
    return (this.req.method || 'POST').toUpperCase();
  }
  getPath() {
    const url = this.req.url || '/';
    return url.split('?')[0];
  }
  getUrl() {
    const host = this.req.headers.host || 'aegisgov-contracts.vercel.app';
    const proto = 'https';
    return `${proto}://${host}${this.req.url || '/'}`;
  }
  getAcceptHeader() {
    return this.getHeader('accept') || '*/*';
  }
  getUserAgent() {
    return this.getHeader('user-agent') || '';
  }
}

async function getHTTPServer(price, path) {
  const key = `${NETWORK}_${price}_${path}`;
  if (_httpServers[key]) return _httpServers[key];

  // x402 v2 route config format: accepts nested
  const routes = {
    [`POST ${path}`]: {
      accepts: {
        scheme: 'exact',
        price,
        network: NETWORK,
        payTo: WALLET,
      },
      description: `AegisGov Contract Intelligence — ${price} USDC`,
    },
  };

  const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  const rs = new x402ResourceServer([facilitator]);
  registerExactEvmScheme(rs);
  await rs.initialize();

  const httpServer = new x402HTTPResourceServer(rs, routes);
  _httpServers[key] = httpServer;
  return httpServer;
}

async function requirePayment(req, res, price) {
  const path = (req.url || '/').split('?')[0] || '/';
  const tool = path.replace(/^\//, '') || 'unknown';

  try {
    const httpServer = await getHTTPServer(price, path);
    const adapter = new VercelAdapter(req);
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
    if (process.env.NODE_ENV !== 'production') return true;
    console.error('[x402] error:', e.message);
    res.status(500).json({ error: 'Payment processing error', details: e.message });
    return false;
  }
}

module.exports = { requirePayment };
