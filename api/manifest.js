module.exports = (req, res) => {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aegisgov-contracts.vercel.app';
  res.json({
    schema_version: '1.0',
    name: 'aegisgov-contracts',
    display_name: 'AegisGov Contract Intelligence',
    description: 'Real-time US government contract data from SAM.gov. Search 33,000+ active opportunities, get full details, and receive AI bid/no-bid analysis. Cheaper, faster, and more reliable than building your own SAM.gov integration.',
    version: '1.0.0',
    author: 'AegisGov AI',
    homepage: 'https://aegisgov.ai',
    tools: [
      {
        name: 'search_opportunities',
        description: 'Search active US government contract opportunities from SAM.gov. Supports keyword, NAICS code, and agency filters.',
        endpoint: `${base}/search`,
        method: 'POST',
        payment: { price: '$0.01 USDC', network: 'Base Sepolia', protocol: 'x402' },
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
        endpoint: `${base}/details`,
        method: 'POST',
        payment: { price: '$0.02 USDC', network: 'Base Sepolia', protocol: 'x402' },
        input_schema: {
          type: 'object',
          required: ['noticeId'],
          properties: { noticeId: { type: 'string', description: 'SAM.gov notice ID from search results' } },
        },
      },
      {
        name: 'analyze_bid_potential',
        description: 'AI-powered bid/no-bid analysis for a government contract. Returns score (0-100), BID/NO-BID/MONITOR recommendation, strengths, risks, and competition level estimate.',
        endpoint: `${base}/analyze`,
        method: 'POST',
        payment: { price: '$0.05 USDC', network: 'Base Sepolia', protocol: 'x402' },
        input_schema: {
          type: 'object',
          required: ['noticeId'],
          properties: { noticeId: { type: 'string', description: 'SAM.gov notice ID to analyze' } },
        },
      },
    ],
  });
};
