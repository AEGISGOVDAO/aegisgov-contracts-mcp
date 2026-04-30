module.exports = (req, res) => {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aegisgov-contracts.vercel.app';
  res.json({
    service: 'AegisGov Contract Intelligence MCP',
    description: 'Real-time US government contract data for AI agents. Pay-per-use in USDC via x402.',
    tools: [
      { endpoint: 'POST /search', price: '$0.01 USDC', description: 'Search active SAM.gov opportunities' },
      { endpoint: 'POST /details', price: '$0.02 USDC', description: 'Full opportunity details + contacts' },
      { endpoint: 'POST /analyze', price: '$0.05 USDC', description: 'AI bid/no-bid analysis' },
    ],
    discovery: `${base}/.well-known/mcp.json`,
    payment_protocol: 'x402',
    network: process.env.X402_NETWORK || 'eip155:84532',
    wallet: process.env.WALLET_ADDRESS,
    docs: 'https://aegisgov.ai/mcp',
  });
};
