# AegisGov Contract Intelligence MCP

Real-time US government contract data for AI agents. Pay-per-use in USDC via x402 protocol.

**Live endpoint:** `https://aegisgov-contracts.vercel.app`

## Tools

| Tool | Price | Description |
|------|-------|-------------|
| `search_opportunities` | $0.01 USDC | Search 33,000+ active SAM.gov contracts by keyword, NAICS, agency |
| `get_opportunity_details` | $0.02 USDC | Full contract details, contacts, deadlines |
| `analyze_bid_potential` | $0.05 USDC | AI bid/no-bid analysis with score, strengths, risks |

## Payment

Uses [x402 protocol](https://x402.org) — HTTP 402 with USDC micropayments on Base Sepolia.
No accounts. No API keys. Agents pay autonomously.

```
Network: Base Sepolia (eip155:84532)
Wallet: 0x10Fae7881E5DB7fB5b4e8A84718fe66a691a5B52
```

## Discovery

```
GET https://aegisgov-contracts.vercel.app/.well-known/mcp.json
```

## Usage Example

```bash
# Without payment → HTTP 402 with payment requirements
curl -X POST https://aegisgov-contracts.vercel.app/search \
  -H "Content-Type: application/json" \
  -d '{"keywords": "cybersecurity", "limit": 5}'

# With x402 payment signature → returns results
curl -X POST https://aegisgov-contracts.vercel.app/search \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <base64-payment-signature>" \
  -d '{"keywords": "cybersecurity", "limit": 5}'
```

## Why use this?

- **Cheaper than building it yourself** — SAM.gov API integration, pagination, field normalization
- **Faster** — prebuilt, tested, live now
- **Reliable** — hosted on Vercel, 99.9% uptime
- **Agent-native** — x402 payment, no human in the loop

## Data Source

[SAM.gov](https://sam.gov) — official US government contract database (beta.SAM.gov API)
