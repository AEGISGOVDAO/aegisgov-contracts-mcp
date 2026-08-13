const { searchOpportunities } = require('../lib/sam');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Dual-rail payment: x402 Base USDC ($0.01) + Stripe SPT ($0.50 = 50-call bundle)
  const { requirePayment } = await import('../lib/payment.mjs');
  const paid = await requirePayment(req, res, '0.01', '0.50');
  if (!paid) return;

  try {
    const { keywords, naics, agency, limit } = req.body || {};
    const result = await searchOpportunities({ keywords, naics, agency, limit: limit || 10 });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
