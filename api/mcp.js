// MCP Streamable HTTP endpoint — Model Context Protocol v1.0
// Handles: initialize, tools/list, tools/call
// Enables compatibility with Claude Desktop, Cursor, Cline, and Glama

const { searchOpportunities, getOpportunityDetails, analyzeBidPotential } = require('../sam-api');

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
    description: 'Search active US government contract opportunities from SAM.gov. Filter by keywords, NAICS code, agency, or dollar value.',
    inputSchema: {
      type: 'object',
      properties: {
        keywords:  { type: 'string',  description: 'Search keywords' },
        naics:     { type: 'string',  description: 'NAICS code filter' },
        agency:    { type: 'string',  description: 'Agency name filter' },
        minValue:  { type: 'number',  description: 'Minimum contract value USD' },
        maxValue:  { type: 'number',  description: 'Maximum contract value USD' },
        limit:     { type: 'integer', description: 'Max results (1-25)', default: 10 },
      },
    },
  },
  {
    name: 'get_opportunity_details',
    description: 'Get full details for a specific SAM.gov contract opportunity by notice ID.',
    inputSchema: {
      type: 'object',
      required: ['noticeId'],
      properties: {
        noticeId: { type: 'string', description: 'SAM.gov notice ID' },
      },
    },
  },
  {
    name: 'analyze_bid_potential',
    description: 'AI-powered bid/no-bid analysis for a government contract opportunity.',
    inputSchema: {
      type: 'object',
      required: ['noticeId'],
      properties: {
        noticeId:    { type: 'string', description: 'SAM.gov notice ID' },
        companyProfile: { type: 'string', description: 'Brief company description for fit analysis' },
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
