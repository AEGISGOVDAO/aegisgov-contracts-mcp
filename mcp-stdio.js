#!/usr/bin/env node
// mcp-stdio.js — stdio MCP entrypoint for Glama / mcp-proxy / Claude Desktop
// Communicates over stdin/stdout using newline-delimited JSON-RPC 2.0
// ALL logs go to stderr — stdout is JSON-only

'use strict';

require('dotenv').config({ quiet: true });

const { searchOpportunities, getOpportunityDetails, analyzeBidPotential } = require('./sam-api');

// Redirect any console.log to stderr so stdout stays clean
console.log = (...args) => process.stderr.write('[log] ' + args.join(' ') + '\n');

process.stderr.write('[aegisgov-contracts-mcp] stdio server starting\n');

// ── Tool definitions ──────────────────────────────────────────────────────────

const SERVER_INFO = { name: 'aegisgov-contracts', version: '1.0.0' };
const CAPABILITIES = { tools: {} };

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
    outputSchema: {
      type: 'object',
      properties: {
        ok:    { type: 'boolean', description: 'True if the request succeeded.' },
        total: { type: 'integer', description: 'Total matching opportunities in SAM.gov.' },
        count: { type: 'integer', description: 'Number of results returned in this response.' },
        opportunities: {
          type: 'array',
          description: 'List of matching contract opportunities.',
          items: {
            type: 'object',
            properties: {
              noticeId:      { type: 'string', description: 'Unique SAM.gov notice ID. Use in get_opportunity_details or analyze_bid_potential.' },
              title:         { type: 'string', description: 'Contract opportunity title.' },
              agency:        { type: 'string', description: 'Contracting agency name.' },
              naicsCode:     { type: 'string', description: '6-digit NAICS industry code.' },
              type:          { type: 'string', description: 'Solicitation type (e.g. Solicitation, Award Notice, Sources Sought).' },
              postedDate:    { type: 'string', description: 'Date posted on SAM.gov (YYYY-MM-DD).' },
              responseDeadline: { type: 'string', description: 'Response/offer due date (ISO 8601).' },
              estimatedValue: { type: 'number', description: 'Estimated contract value in USD, if disclosed.' },
              setAside:      { type: 'string', description: 'Set-aside designation (e.g. Small Business, 8(a), WOSB).' },
              placeOfPerformance: { type: 'string', description: 'Primary place of performance.' },
            },
          },
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
    outputSchema: {
      type: 'object',
      properties: {
        ok:          { type: 'boolean' },
        opportunity: {
          type: 'object',
          description: 'Full contract opportunity record.',
          properties: {
            noticeId:           { type: 'string', description: 'SAM.gov notice ID.' },
            title:              { type: 'string', description: 'Contract title.' },
            agency:             { type: 'string', description: 'Contracting agency.' },
            description:        { type: 'string', description: 'Full statement of work / opportunity description.' },
            naicsCode:          { type: 'string', description: 'NAICS code.' },
            type:               { type: 'string', description: 'Solicitation type.' },
            postedDate:         { type: 'string', description: 'Date posted (YYYY-MM-DD).' },
            responseDeadline:   { type: 'string', description: 'Offer due date (ISO 8601).' },
            estimatedValue:     { type: 'number', description: 'Estimated value in USD.' },
            setAside:           { type: 'string', description: 'Set-aside designation.' },
            placeOfPerformance: { type: 'string', description: 'Place of performance.' },
            pointOfContact:     { type: 'object', description: 'Primary contracting officer contact.',
              properties: {
                name:  { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
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
    outputSchema: {
      type: 'object',
      properties: {
        ok:               { type: 'boolean' },
        noticeId:         { type: 'string',  description: 'SAM.gov notice ID that was analyzed.' },
        score:            { type: 'integer', description: 'Bid fit score from 0 (no fit) to 100 (strong fit).' },
        recommendation:   { type: 'string',  description: 'BID or NO-BID recommendation.', enum: ['BID', 'NO-BID'] },
        summary:          { type: 'string',  description: 'Plain-language explanation of the recommendation.' },
        strengths:        { type: 'array',   items: { type: 'string' }, description: 'List of factors supporting a bid.' },
        risks:            { type: 'array',   items: { type: 'string' }, description: 'List of risks or weaknesses identified.' },
        competitionLevel: { type: 'string',  description: 'Estimated competition level.', enum: ['low', 'medium', 'high'] },
      },
    },
  },
];

// ── Tool dispatch ─────────────────────────────────────────────────────────────

async function handleToolCall(name, args = {}) {
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

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function jsonrpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const { method, id, params } = msg;

  try {
    switch (method) {
      case 'initialize':
        send(jsonrpc(id, {
          protocolVersion: '2025-03-26',
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES,
        }));
        break;

      case 'notifications/initialized':
        // Notification — no response
        break;

      case 'tools/list':
        send(jsonrpc(id, { tools: TOOLS }));
        break;

      case 'tools/call': {
        const { name, arguments: args = {} } = params || {};
        if (!name) {
          send(jsonrpcError(id, -32602, 'Missing tool name'));
          break;
        }
        const result = await handleToolCall(name, args);
        send(jsonrpc(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }));
        break;
      }

      case 'ping':
        send(jsonrpc(id, {}));
        break;

      default:
        send(jsonrpcError(id, -32601, `Method not found: ${method}`));
    }
  } catch (err) {
    process.stderr.write(`[aegisgov-contracts-mcp] error: ${err.message}\n`);
    if (id !== undefined && id !== null) {
      send(jsonrpcError(id, -32603, err.message));
    }
  }
}

// ── stdin reader (newline-delimited JSON) ─────────────────────────────────────

let buffer = '';
let pendingCount = 0;
let stdinEnded = false;

function checkDone() {
  if (stdinEnded && pendingCount === 0) {
    process.stderr.write('[aegisgov-contracts-mcp] all requests done, exiting\n');
    process.exit(0);
  }
}

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop(); // keep incomplete last line

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (e) {
      process.stderr.write(`[aegisgov-contracts-mcp] invalid JSON: ${trimmed}\n`);
      send(jsonrpcError(null, -32700, 'Parse error'));
      continue;
    }
    pendingCount++;
    handleMessage(msg)
      .catch((err) => process.stderr.write(`[aegisgov-contracts-mcp] unhandled: ${err.message}\n`))
      .finally(() => { pendingCount--; checkDone(); });
  }
});

process.stdin.on('end', () => {
  // Flush any remaining buffered line (no trailing newline)
  const trimmed = buffer.trim();
  if (trimmed) {
    let msg;
    try {
      msg = JSON.parse(trimmed);
      pendingCount++;
      handleMessage(msg)
        .catch((err) => process.stderr.write(`[aegisgov-contracts-mcp] unhandled: ${err.message}\n`))
        .finally(() => { pendingCount--; checkDone(); });
    } catch (e) {
      send(jsonrpcError(null, -32700, 'Parse error'));
    }
  }
  stdinEnded = true;
  process.stderr.write('[aegisgov-contracts-mcp] stdin closed\n');
  checkDone();
});

// ── Error guards ──────────────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  process.stderr.write(`[aegisgov-contracts-mcp] uncaught: ${err.message}\n`);
  // Don't exit — keep serving
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[aegisgov-contracts-mcp] unhandled rejection: ${reason}\n`);
  // Don't exit — keep serving
});

process.stdout.on('error', (err) => {
  // mcp-proxy closed the pipe — graceful exit
  if (err.code === 'EPIPE') process.exit(0);
  process.stderr.write(`[aegisgov-contracts-mcp] stdout error: ${err.message}\n`);
});
