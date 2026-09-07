// api/activate.js — Exchange Stripe checkout session for an API key
// Called after successful payment: /api/activate?session_id={CHECKOUT_SESSION_ID}
// Returns JSON with the API key + usage instructions.
// Also used by webhook (internal) to pre-validate sessions.

'use strict';
const { generateKey } = require('../lib/apikey');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { session_id } = req.query;
  if (!session_id || !session_id.startsWith('cs_')) {
    return res.status(400).json({ error: 'Missing or invalid session_id' });
  }

  try {
    // Lazy-load stripe to keep cold starts fast
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed', status: session.payment_status });
    }

    const email = session.customer_details?.email || session.customer_email || 'unknown';
    const plan = 'contracts-mcp';
    const daysValid = 30;
    const apiKey = generateKey(email, plan, daysValid);
    const expiresAt = new Date(Date.now() + daysValid * 24 * 3600 * 1000).toISOString();

    return res.status(200).json({
      ok: true,
      apiKey,
      email,
      plan,
      expiresAt,
      daysValid,
      instructions: {
        header: 'Authorization: Bearer ' + apiKey,
        altHeader: 'X-API-Key: ' + apiKey,
        example: {
          description: 'Add to any MCP tool call:',
          curl: `curl -X POST https://aegisgov-contracts-mcp.vercel.app/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"analyze_bid_potential","arguments":{"opportunity_id":"YOUR_ID"}}}'`,
        },
        mcpConfig: {
          description: 'Add to your MCP client config (Claude Desktop / Cursor / Cline):',
          json: {
            url: 'https://aegisgov-contracts-mcp.vercel.app/mcp',
            type: 'streamable-http',
            headers: { Authorization: 'Bearer ' + apiKey },
          },
        },
      },
      support: 'contact@aegisgov.ai',
    });
  } catch (err) {
    console.error('[activate] error:', err.message);
    return res.status(500).json({ error: 'Failed to activate key', detail: err.message });
  }
};
