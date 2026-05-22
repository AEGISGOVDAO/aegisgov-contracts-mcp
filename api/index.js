module.exports = (req, res) => {
  const demo = process.env.DEMO_MODE === 'true';
  res.json({
    service: 'AegisGov Contract Intelligence MCP',
    description: 'Real-time US government contract data for AI agents. Pay-per-use in USDC via x402.',
    status: demo ? 'FREE BETA — no payment required' : 'Live — x402 USDC payments',
    tools: [
      { endpoint: 'POST /search', price: demo ? 'FREE' : '$0.01 USDC', description: 'Search active SAM.gov opportunities' },
      { endpoint: 'POST /details', price: demo ? 'FREE' : '$0.02 USDC', description: 'Full opportunity details + contacts' },
      { endpoint: 'POST /analyze', price: demo ? 'FREE' : '$0.05 USDC', description: 'AI bid/no-bid analysis' },
    ],
    payment_protocol: 'x402',
    networks: {
      evm: process.env.X402_NETWORK || 'eip155:8453',
      solana: process.env.X402_SOL_NETWORK || 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    },
    facilitator: 'https://facilitator.payai.network',
    data_source: 'SAM.gov — official US government procurement data',
    docs: 'https://aegisgov.ai/mcp',
  });
};
