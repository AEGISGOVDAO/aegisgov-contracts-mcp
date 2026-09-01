// IMPORTANT: Always use the hardcoded canonical production URL.
// Never use VERCEL_URL — that resolves to the current deployment preview URL, not production.
const CANONICAL = 'https://aegisgov-contracts-mcp.vercel.app';

module.exports = (req, res) => {
  res.json({
    schema_version: '1.0',
    name: 'aegisgov-contracts',
    display_name: 'AegisGov Contract Intelligence',
    description: 'Real-time US government contract data from SAM.gov. Search 33,000+ active opportunities, get full details, and receive AI bid/no-bid analysis. Cheaper, faster, and more reliable than building your own SAM.gov integration.',
    version: '1.0.0',
    author: 'AegisGov AI',
    homepage: 'https://aegisgov.ai',
    // Canonical MCP endpoint — use this in all clients
    mcp_endpoint: `${CANONICAL}/mcp`,
    mcp_config: { url: `${CANONICAL}/mcp`, type: 'streamable-http' },
    tools: [
      {
        name: 'search_opportunities',
        description: 'Search active US government contract opportunities from SAM.gov. Supports keyword, NAICS code, and agency filters.',
        endpoint: `${CANONICAL}/mcp`,
        method: 'POST (MCP streamable-http)',
        payment: { price: 'FREE', note: 'search_opportunities is free with no payment required' },
        input_schema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: 'Search keywords e.g. "cybersecurity managed services"' },
            naics: { type: 'string', description: 'NAICS code filter e.g. "541512"' },
            agency: { type: 'string', description: 'Agency name filter e.g. "Department of Defense"' },
            limit: { type: 'number', description: 'Results count 1-25 (default 10)' },
          },
        },
      },
      {
        name: 'get_opportunity_details',
        description: 'Get complete details for a SAM.gov opportunity including description, contacts, deadline, and set-aside info.',
        endpoint: `${CANONICAL}/mcp`,
        method: 'POST (MCP streamable-http)',
        payment: { price: 'FREE', note: 'get_opportunity_details is free with no payment required' },
        input_schema: {
          type: 'object',
          required: ['noticeId'],
          properties: { noticeId: { type: 'string', description: 'SAM.gov notice ID from search results' } },
        },
      },
      {
        name: 'analyze_bid_potential',
        description: 'AI-powered bid/no-bid analysis for a government contract. Returns a score (0-100), BID/NO-BID/MONITOR recommendation, key strengths, risks, and estimated competition level.',
        endpoint: `${CANONICAL}/mcp`,
        method: 'POST (MCP streamable-http)',
        payment: { price: '$0.05 USDC', network: 'Base mainnet (eip155:8453)', protocol: 'x402 + MPP/Stripe SPT', note: 'analyze_bid_potential requires payment' },
        input_schema: {
          type: 'object',
          required: ['noticeId'],
          properties: { noticeId: { type: 'string', description: 'SAM.gov notice ID to analyze' } },
        },
      },
    ],
  });
};
