const CANONICAL = 'https://aegisgov-contracts-mcp.vercel.app';

module.exports = (req, res) => {
  res.json({
    service: 'AegisGov Contract Intelligence MCP',
    description: 'Real-time US government contract data for AI agents. Free tier (search+details) + $0.05 USDC for AI bid analysis.',
    mcp_endpoint: `${CANONICAL}/mcp`,
    mcp_config: { url: `${CANONICAL}/mcp`, type: 'streamable-http' },
    tools: [
      { name: 'search_opportunities',    price: 'FREE',       description: 'Search 33k+ active SAM.gov opportunities' },
      { name: 'get_opportunity_details', price: 'FREE',       description: 'Full opportunity details + contacts' },
      { name: 'analyze_bid_potential',   price: '$0.05 USDC', description: 'AI bid/no-bid analysis (x402 + MPP/Stripe)' },
    ],
    payment_protocol: 'x402 v2 + MPP/Stripe SPT',
    network: 'Base mainnet (eip155:8453)',
    facilitator: 'https://facilitator.payai.network',
    data_source: 'SAM.gov — official US government procurement data',
    docs: 'https://aegisgov.ai/mcp',
    github: 'https://github.com/AEGISGOVDAO/aegisgov-contracts-mcp',
  });
};
