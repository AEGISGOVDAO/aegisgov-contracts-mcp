require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');
const { searchOpportunities, getOpportunityDetails, analyzeBidPotential } = require('./sam-api');

const app = express();
app.use(cors());
app.use(express.json());

const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.X402_NETWORK || 'eip155:84532'; // Base Sepolia testnet (use eip155:8453 + CDP key for mainnet)
const FACILITATOR_URL = process.env.X402_FACILITATOR || 'https://x402.org/facilitator';

// ─── Health & Discovery (no payment required) ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aegisgov-contracts', version: '1.0.0', wallet: WALLET, network: NETWORK, uptime: process.uptime() });
});

app.get('/', (req, res) => {
  const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3742}`;
  res.json({
    service: 'AegisGov Contract Intelligence MCP',
    description: 'Government contract data API for AI agents. Pay per use in USDC on Base.',
    tools: ['POST /search ($0.01 USDC)', 'POST /details ($0.02 USDC)', 'POST /analyze ($0.05 USDC)'],
    discovery: `${base}/.well-known/mcp.json`,
    payment_protocol: 'x402',
    network: 'Base (eip155:8453)',
    docs: 'https://aegisgov.ai/mcp',
  });
});

app.get('/.well-known/mcp.json', (req, res) => {
  const base = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3742}`;
  res.json({
    schema_version: '1.0',
    name: 'aegisgov-contracts',
    display_name: 'AegisGov Contract Intelligence',
    description: 'Real-time US government contract data from SAM.gov. Search opportunities, get full details, and AI bid/no-bid analysis. Cheaper and faster than building your own SAM.gov integration.',
    version: '1.0.0',
    author: 'AegisGov AI',
    homepage: 'https://aegisgov.ai',
    tools: [
      {
        name: 'search_opportunities',
        description: 'Search active US government contract opportunities. Filter by keywords, NAICS code, agency, or value.',
        endpoint: `${base}/search`,
        method: 'POST',
        payment: { price: '$0.01 USDC', network: 'Base', protocol: 'x402' },
        input_schema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Search keywords (e.g. "cybersecurity IT services")' },
            naics: { type: 'string', description: 'NAICS code filter (e.g. "541512")' },
            agency: { type: 'string', description: 'Agency name filter' },
            limit: { type: 'number', description: 'Max results 1-25, default 10' },
          },
        },
      },
      {
        name: 'get_opportunity_details',
        description: 'Get full details for a specific contract opportunity including description, contacts, and deadlines.',
        endpoint: `${base}/details`,
        method: 'POST',
        payment: { price: '$0.02 USDC', network: 'Base', protocol: 'x402' },
        input_schema: {
          type: 'object',
          required: ['noticeId'],
          properties: { noticeId: { type: 'string', description: 'SAM.gov notice ID' } },
        },
      },
      {
        name: 'analyze_bid_potential',
        description: 'AI-powered bid/no-bid analysis. Returns score 0-100, recommendation, strengths, risks, and competition level.',
        endpoint: `${base}/analyze`,
        method: 'POST',
        payment: { price: '$0.05 USDC', network: 'Base', protocol: 'x402' },
        input_schema: {
          type: 'object',
          required: ['noticeId'],
          properties: { noticeId: { type: 'string', description: 'SAM.gov notice ID to analyze' } },
        },
      },
    ],
  });
});

// ─── Paid Routes (registered AFTER x402 middleware in main()) ─────────────
function registerPaidRoutes() {
  app.post('/search', async (req, res) => {
    try {
      const { keywords, naics, agency, minValue, maxValue, limit } = req.body || {};
      const result = await searchOpportunities({ keywords, naics, agency, minValue, maxValue, limit: limit || 10 });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/details', async (req, res) => {
    try {
      const { noticeId } = req.body || {};
      if (!noticeId) return res.status(400).json({ ok: false, error: 'noticeId required' });
      const result = await getOpportunityDetails(noticeId);
      res.json({ ok: true, opportunity: result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/analyze', async (req, res) => {
    try {
      const { noticeId } = req.body || {};
      if (!noticeId) return res.status(400).json({ ok: false, error: 'noticeId required' });
      const result = await analyzeBidPotential(noticeId);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────
async function main() {
  // Init x402 FIRST, then register paid routes so middleware intercepts them
  let x402Ready = false;
  try {
    const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
    const resourceServer = new x402ResourceServer([facilitator]);
    registerExactEvmScheme(resourceServer);
    await resourceServer.initialize();

    const routes = {
      'POST /search':  { accepts: [{ scheme: 'exact', price: '$0.01', network: NETWORK, payTo: WALLET }], description: 'Search SAM.gov contract opportunities' },
      'POST /details': { accepts: [{ scheme: 'exact', price: '$0.02', network: NETWORK, payTo: WALLET }], description: 'Get full opportunity details' },
      'POST /analyze': { accepts: [{ scheme: 'exact', price: '$0.05', network: NETWORK, payTo: WALLET }], description: 'AI bid/no-bid analysis' },
    };

    const mw = paymentMiddleware(routes, resourceServer, undefined, undefined, false);
    app.use(mw);
    x402Ready = true;
  } catch (e) {
    console.warn('x402 init failed (routes unprotected):', e.message);
  }

  registerPaidRoutes();

  const PORT = process.env.PORT || 3742;
  app.listen(PORT, () => {
    console.log('🦅 AegisGov Contract Intelligence MCP');
    console.log(`   Port:    ${PORT}`);
    console.log(`   Wallet:  ${WALLET}`);
    console.log(`   Network: ${NETWORK}`);
    console.log(`   x402:    ${x402Ready ? 'ACTIVE ✅' : 'DISABLED ⚠️'}`);
  });
}

main().catch(console.error);
