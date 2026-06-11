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
    description: 'Search active US government contract opportunities from SAM.gov. Filter by keywords, NAICS code, agency, or dollar value. FREE — no payment required.',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: { type: 'string',  description: 'Search keywords' },
        naics:    { type: 'string',  description: 'NAICS code filter' },
        agency:   { type: 'string',  description: 'Agency name filter' },
        minValue: { type: 'number',  description: 'Minimum contract value USD' },
        maxValue: { type: 'number',  description: 'Maximum contract value USD' },
        limit:    { type: 'integer', description: 'Max results (1-25)', default: 10 },
      },
    },
  },
  {
    name: 'get_opportunity_details',
    description: 'Get full details for a specific SAM.gov contract opportunity by notice ID. FREE — no payment required.',
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
    description: 'AI-powered bid/no-bid analysis for a government contract opportunity. Returns score 0-100, recommendation, strengths, and risks.',
    inputSchema: {
      type: 'object',
      required: ['noticeId'],
      properties: {
        noticeId:       { type: 'string', description: 'SAM.gov notice ID' },
        companyProfile: { type: 'string', description: 'Brief company description for fit analysis' },
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
