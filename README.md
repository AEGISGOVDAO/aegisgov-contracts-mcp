# AegisGov Contract Intelligence MCP

Real-time US government contract data for AI agents. Search and details are **completely free** — no API key, no payment, no signup.

**Live endpoint:** `https://aegisgov-contracts-mcp.vercel.app`

## Add to Claude Desktop / Cline / Cursor in 60 seconds

```json
{
  "mcpServers": {
    "aegisgov-contracts": {
      "url": "https://aegisgov-contracts-mcp.vercel.app/mcp",
      "type": "streamable-http"
    }
  }
}
```

That's it. Your agent can now search 33,000+ live US federal contract opportunities.

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `search_opportunities` | 🆓 FREE | Search active SAM.gov contracts by keyword, NAICS, agency, value range |
| `get_opportunity_details` | 🆓 FREE | Full contract details, contacts, deadlines by notice ID |
| `analyze_bid_potential` | $0.05 USDC | AI bid/no-bid analysis with score, strengths, risks |

## Quick Start

```bash
# Search active contracts
curl -X POST https://aegisgov-contracts-mcp.vercel.app/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "cybersecurity", "limit": 5}'

# Full contract details
curl -X POST https://aegisgov-contracts-mcp.vercel.app/details \
  -H "Content-Type: application/json" \
  -d '{"noticeId": "<noticeId from search>"}'

# AI bid/no-bid analysis
curl -X POST https://aegisgov-contracts-mcp.vercel.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"noticeId": "<noticeId>"}'
```

## MCP Discovery

```
GET https://aegisgov-contracts-mcp.vercel.app/.well-known/mcp.json
```

## Payment (x402)

Uses [x402 protocol](https://x402.org) — HTTP 402 with USDC micropayments. No accounts. No API keys. Agents pay autonomously.

**Supported networks:**
- Base mainnet (`eip155:8453`) — USDC
- Solana mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`) — USDC

**Facilitator:** [PayAI](https://payai.network) — free tier, no key required

## Why use this?

- **No SAM.gov API hassle** — registration, rate limits, field normalization all handled
- **33,000+ live opportunities** — always current
- **AI analysis built in** — bid scoring, risk flags, competition level
- **Agent-native** — designed for MCP, works with Claude, GPT, any LLM toolchain
- **Dual-network x402** — pay in USDC on Base or Solana

## Data Source

[SAM.gov](https://sam.gov) — official US government procurement data (FPDS/USASpending.gov)

## Links

- **Live:** https://aegisgov-contracts-mcp.vercel.app
- **Docs:** https://aegisgov.ai/mcp
- **GitHub:** https://github.com/AEGISGOVDAO/aegisgov-contracts-mcp
