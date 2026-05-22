# AegisGov Contract Intelligence MCP

Real-time US government contract data for AI agents. **Currently free — no payment required.**

**Live endpoint:** `https://aegisgov-contracts-mcp.vercel.app`

> 🆓 **Free Demo Mode active.** All tools return real data at no cost. x402 USDC payments (Base mainnet + Solana mainnet) activate when ready.

## Tools

| Tool | Endpoint | Description |
|------|----------|-------------|
| `search` | `POST /search` | Search 33,000+ active SAM.gov contracts by keyword, NAICS, agency |
| `details` | `POST /details` | Full contract details, contacts, deadlines |
| `analyze` | `POST /analyze` | AI bid/no-bid analysis with score, strengths, risks |

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
