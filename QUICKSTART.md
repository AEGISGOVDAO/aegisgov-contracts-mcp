# Quickstart — Aegisgov Contracts MCP

Two paths: connect via an MCP-compatible AI agent, or call the REST API directly.

---

## Path 1 — MCP Agent (Claude Desktop / Cline / Cursor)

Add to your MCP config:

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

Then ask your agent:
- "Search for cybersecurity contracts under $500K" → free
- "Analyze bid potential for notice ID `<noticeId>`" → $0.05 USDC via x402

**Note:** MCP clients that support x402 will handle payment automatically. Clients that don't will receive a 402 response; use Path 2 for programmatic x402 payment.

---

## Path 2 — Direct REST API (runnable)

This script shows the complete free → paid flow.

**Requirements:**
```
node >= 18
npm install @x402/fetch node-fetch
```

**Wallet:** You need a Base mainnet wallet with at least $0.05 USDC. Get USDC on Base via Coinbase, Uniswap, or any Base DEX.

```javascript
// quickstart.mjs
// Usage: WALLET_PRIVATE_KEY=0x... node quickstart.mjs

import { wrapFetchWithPayment } from '@x402/fetch';
import fetch from 'node-fetch';

const BASE = 'https://aegisgov-contracts-mcp.vercel.app';
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('Set WALLET_PRIVATE_KEY env var to a Base mainnet wallet private key with USDC');
  process.exit(1);
}

// Wrap fetch with x402 auto-pay: handles 402 → sign payment → retry automatically
const paidFetch = wrapFetchWithPayment(fetch, {
  privateKey: PRIVATE_KEY,
  network: 'eip155:8453',                           // Base mainnet
  facilitator: 'https://facilitator.payai.network',  // free, no key required
});

async function main() {
  // ── Step 1: Search — FREE ──────────────────────────────────────────────
  console.log('1. Searching for cybersecurity contracts (free)...');
  const searchRes = await fetch(`${BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords: 'cybersecurity', limit: 3 }),
  });
  const searchData = await searchRes.json();

  if (!searchData.ok || !searchData.opportunities?.length) {
    console.error('Search failed:', searchData);
    process.exit(1);
  }

  const opp = searchData.opportunities[0];
  console.log(`   → ${opp.title}`);
  console.log(`     Agency: ${opp.agency}`);
  console.log(`     Value:  $${opp.estimatedValue?.toLocaleString() ?? 'undisclosed'}`);
  console.log(`     Notice: ${opp.noticeId}`);
  console.log(`     Deadline: ${opp.responseDeadline}`);

  // ── Step 2: Analyze — PAID ($0.05 USDC, x402 auto-paid) ───────────────
  console.log('\n2. Analyzing bid potential ($0.05 USDC via x402)...');
  const analyzeRes = await paidFetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      noticeId: opp.noticeId,
      companyProfile: 'Small IT firm specializing in cloud security, FedRAMP experience',
    }),
  });
  const analysis = await analyzeRes.json();

  if (!analysis.ok) {
    console.error('Analysis failed:', analysis);
    process.exit(1);
  }

  console.log(`\n   Recommendation: ${analysis.recommendation} (score: ${analysis.score}/100)`);
  console.log(`   Summary: ${analysis.summary}`);
  console.log(`   Strengths:`);
  analysis.strengths?.forEach(s => console.log(`     + ${s}`));
  console.log(`   Risks:`);
  analysis.risks?.forEach(r => console.log(`     - ${r}`));
  console.log(`   Competition: ${analysis.competitionLevel}`);
  console.log('\n   Total cost: $0.05 USDC');
}

main().catch(console.error);
```

**Expected output:**
```
1. Searching for cybersecurity contracts (free)...
   → DoD Cybersecurity Assessment Services
     Agency: Department of Defense
     Value:  $2,500,000
     Notice: a3f2b1c9d4e5f678...
     Deadline: 2026-09-15T16:00:00Z

2. Analyzing bid potential ($0.05 USDC via x402)...
   Recommendation: BID (score: 78/100)
   Summary: Strong match for small IT security firms with FedRAMP experience...
   Strengths:
     + Small business set-aside
     + NAICS 541519 aligns with capabilities
   Risks:
     - 45-day turnaround may be tight
     - Incumbent contractor advantage
   Competition: MEDIUM

   Total cost: $0.05 USDC
```

---

## How the payment works

1. `paidFetch` sends the request to `/analyze`
2. Server returns HTTP 402 with a `payment-required` header (base64 x402 challenge)
3. `wrapFetchWithPayment` decodes the requirements, signs a payment on Base mainnet, submits to the PayAI facilitator
4. Facilitator verifies the on-chain payment and returns a payment receipt
5. `paidFetch` retries the original request with an `X-Payment` header containing the receipt
6. Server verifies the receipt and executes the analysis
7. Result returned — no manual wallet interaction needed

---

## Inspect the 402 response manually

```bash
# See the raw 402 challenge (no payment header):
curl -si -X POST https://aegisgov-contracts-mcp.vercel.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"noticeId":"any-id"}' | grep -E "HTTP|payment-required|www-authenticate"
```

---

## Pricing

| Tool | Cost | Notes |
|---|---|---|
| `search_opportunities` | FREE | Up to 25 results, all SAM.gov filters |
| `get_opportunity_details` | FREE | Full text, contacts, deadlines |
| `analyze_bid_potential` | $0.05 USDC | AI bid/no-bid with score, strengths, risks |

Payment: USDC on Base mainnet via [x402 protocol](https://x402.org) and [PayAI facilitator](https://facilitator.payai.network).

---

## Resources

- x402 spec: <https://x402.org>
- PayAI facilitator: <https://facilitator.payai.network>
- MCP protocol: <https://modelcontextprotocol.io>
- Aegis support: admin@aegisgov.ai
