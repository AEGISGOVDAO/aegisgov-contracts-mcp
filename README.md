# AegisGov Contract Intelligence MCP

Real-time US government contract data for AI agents. **Currently free — no payment required.**

**Live endpoint:** `https://aegisgov-contracts.vercel.app`

> 🆓 **Free Demo Mode active.** All tools return real data at no cost. Payment (USDC/x402) will be enabled when Base mainnet support goes live. Use it now, build on it, no friction.

## Tools

| Tool | Status | Description |
|------|--------|-------------|
| `search_opportunities` | 🆓 Free | Search 33,000+ active SAM.gov contracts by keyword, NAICS, agency |
| `get_opportunity_details` | 🆓 Free | Full contract details, contacts, deadlines |
| `analyze_bid_potential` | 🆓 Free | AI bid/no-bid analysis with score, strengths, risks |

## Quick Start

```bash
# Search active contracts — returns immediately, no auth needed
curl -X POST https://aegisgov-contracts.vercel.app/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "cybersecurity", "limit": 5}'

# Get full details for a contract
curl -X POST https://aegisgov-contracts.vercel.app/details \
  -H "Content-Type: application/json" \
  -d '{"noticeId": "<noticeId from search>"}'

# AI bid/no-bid analysis
curl -X POST https://aegisgov-contracts.vercel.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"noticeId": "<noticeId>"}'
```

## Discovery

```
GET https://aegisgov-contracts.vercel.app/.well-known/mcp.json
```

## Why use this?

- **No SAM.gov API hassle** — registration, rate limits, field normalization all handled
- **33,000+ live opportunities** — always current
- **AI analysis built in** — bid scoring, risk flags, competition level
- **Agent-native** — designed for MCP, works with Claude, GPT, any LLM toolchain
- **x402 ready** — payment infrastructure in place for when monetization goes live

## Payment (Coming Soon)

Will use [x402 protocol](https://x402.org) — HTTP 402 with USDC micropayments on Base mainnet.
No accounts. No API keys. Agents pay autonomously.

```
Wallet: 0x10Fae7881E5DB7fB5b4e8A84718fe66a691a5B52
```

## Data Source

[SAM.gov](https://sam.gov) — official US government contract database (beta.SAM.gov API)
