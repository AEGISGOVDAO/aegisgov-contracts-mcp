# Payment Architecture — Aegisgov Contracts MCP

## Overview

Dual-rail 402 payment system: agents and humans can pay via whichever rail they support.

| Rail | Protocol | Currency | Amount |
|---|---|---|---|
| EVM/x402 | x402 v2 | USDC on Base mainnet | per-tool (see below) |
| Stripe SPT | MPP (Machine Payments Protocol) | USD fiat (card/Link) | $0.50 flat bundle |

Both rails return on a single HTTP 402 response — the client picks one.

---

## Tool Pricing

| Tool | Free | EVM/USDC | Stripe Bundle |
|---|---|---|---|
| `search_opportunities` | ✅ free | — | — |
| `get_opportunity_details` | ✅ free | — | — |
| `analyze_bid_potential` | ❌ gated | $0.05 USDC | $0.50 = 10 calls |

---

## Implementation

### File: `lib/payment.mjs`

Core module. Exports a single `requirePayment(req, res, evmAmount, stripeAmount)` function used by each gated API route.

**How it works:**
1. Checks `DEMO_MODE` — if true, bypasses all payment (free tier / dev testing)
2. Converts Vercel's Node.js request to a Web Request (mppx needs fetch-compatible input)
3. Calls `mppx.compose()` with both EVM and Stripe entries
4. If payment not satisfied → returns HTTP 402 with dual challenge headers:
   - `payment-required` (x402 format) → EVM/Base USDC path
   - `www-authenticate` (MPP format) → Stripe SPT path
5. Returns `true` when paid, `false` when 402 was sent

### Dependencies

```
mppx        — Stripe's MPP server SDK
@x402/node  — x402 v2 server library (via PayAI facilitator)
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WALLET_ADDRESS` | ✅ | EVM wallet to receive USDC payments |
| `X402_FACILITATOR` | ✅ | `https://facilitator.payai.network` |
| `X402_NETWORK` | ✅ | `eip155:8453` (Base mainnet) |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key (sk_live_...) |
| `STRIPE_PROFILE_ID` | ⏳ | `profile_xxx` — Stripe MPP private preview; activate when issued |
| `MPP_SECRET_KEY` | ✅ | HMAC secret for mppx token signing (`openssl rand -base64 32`) |
| `DEMO_MODE` | ✅ | `false` in production; `true` for free/demo mode |

> **Stripe SPT status (Aug 12, 2026):** Applied for MPP private preview at machine-payments@stripe.com. Waiting on `profile_xxx` ID. EVM/x402 path is fully live. Stripe path activates automatically once `STRIPE_PROFILE_ID` is set in Vercel.

---

## EVM Payment Path (Live)

- **Network:** Base mainnet (`eip155:8453`)
- **Token:** USDC
- **Facilitator:** `https://facilitator.payai.network` (free tier, no API key needed)
- **Wallet:** `0x10Fae7881E5DB7fB5b4e8A84718fe66a691a5B52`
- **Protocol:** x402 v2

## Stripe SPT Path (Pending Approval)

- **Protocol:** MPP (Machine Payments Protocol) — `mppx` SDK
- **Bundle:** $0.50 flat = 10x `analyze_bid_potential` calls
- **Payment methods:** card, Link
- **Activates when:** `STRIPE_PROFILE_ID` env var is set in Vercel

---

## Stablecoin Payments (Human-Facing)

Stripe stablecoin payments are **already active** on all 7 Stripe payment links (Stripe `crypto_payments` capability enabled). This is separate from the MPP machine-to-machine rail — it's for human customers paying with crypto through Stripe's standard checkout.

---

## Adding Payment to a New Tool

```js
import { requirePayment } from '../lib/payment.mjs';

export default async function handler(req, res) {
  const paid = await requirePayment(req, res, '0.05'); // $0.05 USDC
  if (!paid) return; // 402 already sent

  // ... tool logic
}
```

---

## Testing

Set `DEMO_MODE=true` in `.env.local` to bypass all payment checks locally.

To test 402 responses, set `DEMO_MODE=false` and send a request without payment headers — you'll get the dual-challenge 402 back.

---

## References

- Stripe MPP docs: https://docs.stripe.com/payments/machine/mpp
- x402 spec: https://x402.org
- PayAI facilitator: https://facilitator.payai.network
- mppx npm: https://www.npmjs.com/package/mppx
