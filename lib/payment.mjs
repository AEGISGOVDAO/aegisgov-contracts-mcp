/**
 * Unified MPP + x402 + Stripe SPT payment handler
 *
 * Dual-challenge 402: agents pick whichever rail they support.
 *   • EVM/x402  — Base mainnet USDC, $0.01/$0.02/$0.05 per call via PayAI facilitator
 *   • Stripe SPT — card/Link fiat, $0.50 flat (= 10-call bundle at analyze price)
 *
 * Stripe SPT is only active when STRIPE_PROFILE_ID env var is set.
 * Apply for access: machine-payments@stripe.com
 */

import crypto from 'node:crypto';
import { Mppx, evm, stripe, NodeListener } from 'mppx/server';

const WALLET        = process.env.WALLET_ADDRESS;
const STRIPE_KEY    = process.env.STRIPE_SECRET_KEY;
const PROFILE_ID    = process.env.STRIPE_PROFILE_ID;   // profile_xxx — set when approved
const MPP_SECRET    = process.env.MPP_SECRET_KEY;       // openssl rand -base64 32
const DEMO_MODE     = process.env.DEMO_MODE === 'true';
const PAYAI_URL     = process.env.X402_FACILITATOR || 'https://facilitator.payai.network';

// ── Methods ────────────────────────────────────────────────────────────────

/** Base mainnet USDC via PayAI facilitator — x402-compatible */
const evmMethod = evm.charge({
  currency:  evm.assets.base.USDC,
  recipient: WALLET,
  x402: { facilitator: PAYAI_URL },
});

const methods = [evmMethod];

/** Stripe SPT fiat — only active when profile ID is configured */
if (PROFILE_ID) {
  methods.push(
    stripe.charge({
      secretKey:          STRIPE_KEY,
      networkId:          PROFILE_ID,
      paymentMethodTypes: ['card', 'link'],
    })
  );
}

// ── mppx instance ──────────────────────────────────────────────────────────

const secretKey = MPP_SECRET || crypto
  .createHmac('sha256', STRIPE_KEY || 'aegisgov-fallback')
  .update('mpp-aegisgov-v1')
  .digest('base64');

const mppx = Mppx.create({ methods, secretKey });

// ── Node.js req → Web Request ──────────────────────────────────────────────

function toWebRequest(req) {
  const host = (req.headers && req.headers.host) || 'aegisgov-contracts-mcp.vercel.app';
  const url  = `https://${host}${req.url || '/'}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (v === undefined) continue;
    (Array.isArray(v) ? v : [v]).forEach(val => headers.append(k, val));
  }

  // Vercel pre-parses JSON bodies; re-serialize so mppx can read body hash
  const rawBody = req.body != null ? JSON.stringify(req.body) : undefined;

  return new Request(url, {
    method:  (req.method || 'POST').toUpperCase(),
    headers,
    body:    rawBody,
    // Required for Node fetch — disable duplex check
    ...(rawBody ? { duplex: 'half' } : {}),
  });
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Gate a Vercel serverless handler behind dual-rail payment.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @param {string} evmAmount   - Display-unit USDC amount, e.g. '0.05'
 * @param {string} [stripeAmount='0.50'] - Display-unit USD amount (min $0.50)
 * @returns {Promise<boolean>}  true = paid/demo, false = 402 sent
 */
export async function requirePayment(req, res, evmAmount, stripeAmount = '0.50') {
  if (DEMO_MODE) return true;

  const webReq = toWebRequest(req);

  // Build compose entries — always x402, add Stripe when profile is live
  const entries = [
    ['evm/charge', { amount: evmAmount }],
    ...(PROFILE_ID ? [['stripe/charge', { amount: stripeAmount }]] : []),
  ];

  const mppResponse = await mppx.compose(...entries)(webReq);

  if (mppResponse.status === 402) {
    await NodeListener.sendResponse(res, mppResponse.challenge);
    return false;
  }

  return true;
}
