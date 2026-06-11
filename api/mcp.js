// MCP Streamable HTTP endpoint — Model Context Protocol v1.0
// Handles: initialize, tools/list, tools/call
// Enables compatibility with Claude Desktop, Cursor, Cline, and Glama

const { searchOpportunities, getOpportunityDetails, analyzeBidPotential } = require('../sam-api');
const { requirePayment } = require('../lib/x402-handler');

const SERVER_INFO = {
  name: 'aegisgov-contracts',
  version: '1.0.0',
};

const CAPABILITIES = {
  tools: {},
};

const TOOLS = [
  {
    name: 'search_opportunities',
    description: [
      'Search live US federal contract opportunities published on SAM.gov.',
      'Use this tool when the user wants to find, browse, or filter active government contracts — for example: "find cybersecurity contracts under $500K" or "show IT services RFPs from the Air Force".',
      'Returns up to 25 opportunities per call (default 10), each with noticeId, title, agency, NAICS code, posted date, response deadline, and estimated value.',
      'This tool is read-only and does not modify any data. Results reflect the live SAM.gov dataset (~33,000 active opportunities at any time).',
      'Use get_opportunity_details to retrieve full text and contacts for a specific result. Use analyze_bid_potential for AI bid scoring.',
      'All parameters are optional — omitting all returns the most recently posted opportunities.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'string',
          description: 'Full-text search keywords. Examples: "cloud infrastructure", "cybersecurity assessment", "janitorial services". Searches title and description fields.',
        },
        naics: {
          type: 'string',
          description: 'Filter by NAICS industry code. Must be a 6-digit string. Examples: "541512" (Computer Systems Design), "336411" (Aircraft Manufacturing), "611710" (Educational Support Services).',
        },
        agency: {
          type: 'string',
          description: 'Filter by contracting agency name. Partial match supported. Examples: "Department of Defense", "Air Force", "Veterans Affairs", "DHS".',
        },
        minValue: {
          type: 'number',
          description: 'Minimum estimated contract value in USD. Example: 100000 filters out contracts under $100K.',
        },
        maxValue: {
          type: 'number',
          description: 'Maximum estimated contract value in USD. Example: 500000 excludes contracts above $500K.',
        },
        limit: {
          type: 'integer',
          description: 'Number of results to return. Integer between 1 and 25. Defaults to 10.',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_opportunity_details',
    description: [
      'Retrieve the complete record for a single SAM.gov contract opportunity by its notice ID.',
      'Use this tool after search_opportunities when the user wants full details on a specific contract — for example: "tell me more about that Air Force contract" or "what are the requirements and deadlines?".',
      'Returns the full opportunity record including: complete description/statement of work, place of performance, response deadline, set-aside type (small business, 8(a), WOSB, etc.), primary contact name and email, attachments list, and amendment history.',
      'This tool is read-only. The noticeId comes from the noticeId field in search_opportunities results.',
      'Use analyze_bid_potential on the same noticeId to get an AI bid/no-bid recommendation.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      required: ['noticeId'],
      properties: {
        noticeId: {
          type: 'string',
          description: 'SAM.gov notice ID for the opportunity. Obtain this from the noticeId field returned by search_opportunities. Example: "a3f2b1c9d4e5f678901234567890abcd".',
        },
      },
    },
  },
  {
    name: 'analyze_bid_potential',
    description: [
      'Run AI-powered bid/no-bid analysis on a specific US government contract opportunity.',
      'Use this tool when the user wants a recommendation on whether to pursue a contract — for example: "should we bid on this?" or "what are our chances on this DoD contract?".',
      'Returns: a numeric score from 0–100 (higher = stronger fit), a BID or NO-BID recommendation, a list of strengths, a list of risks, estimated competition level (low/medium/high), and a plain-language summary.',
      'Optionally provide a companyProfile describing your company capabilities — this significantly improves the relevance of the analysis.',
      'This tool requires a $0.05 USDC payment via x402 protocol on Base mainnet or Solana mainnet. The calling agent must include a valid X-Payment header.',
      'Call get_opportunity_details first if you need the full contract text before analysis.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      required: ['noticeId'],
      properties: {
        noticeId: {
          type: 'string',
          description: 'SAM.gov notice ID for the opportunity to analyze. Obtain from search_opportunities results.',
        },
        companyProfile: {
          type: 'string',
          description: 'Optional. A 1–3 sentence description of the bidding company — capabilities, past performance, certifications (e.g. "Small 8(a) IT firm specializing in cloud migration with DoD clearance"). Improves analysis accuracy.',
        },
      },
    },
  },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'search_opportunities':
      return await searchOpportunities(args);
    case 'get_opportunity_details':
      return await getOpportunityDetails(args.noticeId);
    case 'analyze_bid_potential':
      return await analyzeBidPotential(args.noticeId, args.companyProfile);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function jsonrpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('MCP-Version', '2025-03-26');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /mcp — server info (non-standard but useful for health checks)
  if (req.method === 'GET') {
    return res.json({ server: SERVER_INFO, capabilities: CAPABILITIES, tools: TOOLS.length });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { method, id, params } = body;

  try {
    switch (method) {
      case 'initialize':
        return res.json(jsonrpc(id, {
          protocolVersion: '2025-03-26',
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES,
        }));

      case 'notifications/initialized':
        return res.status(202).end();

      case 'tools/list':
        return res.json(jsonrpc(id, { tools: TOOLS }));

      case 'tools/call': {
        const { name, arguments: args = {} } = params || {};
        if (!name) return res.json(jsonrpcError(id, -32602, 'Missing tool name'));

        // Payment gate — search + details are FREE, analyze requires payment
        // Free tier: zero friction to try the product; gate only on high-value AI analysis
        const PAID_TOOLS = {
          analyze_bid_potential: { price: '$0.05', path: '/analyze' },
        };
        const priceConfig = PAID_TOOLS[name];
        if (priceConfig) {
          // Spoof req.url so requirePayment resolves the correct route
          const patchedReq = Object.assign(Object.create(Object.getPrototypeOf(req)), req, {
            url: priceConfig.path,
          });
          const paid = await requirePayment(patchedReq, res, priceConfig.price);
          if (!paid) return; // 402 already written to res
        }

        const result = await handleToolCall(name, args);
        return res.json(jsonrpc(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }));
      }

      case 'ping':
        return res.json(jsonrpc(id, {}));

      default:
        return res.json(jsonrpcError(id, -32601, `Method not found: ${method}`));
    }
  } catch (err) {
    return res.json(jsonrpcError(id, -32603, err.message));
  }
};
