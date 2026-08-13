const { getOpportunityDetails } = require('../lib/sam');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Dual-rail payment: x402 Base USDC ($0.02) + Stripe SPT ($0.50 = 25-call bundle)
  const { requirePayment } = await import('../lib/payment.mjs');
  const paid = await requirePayment(req, res, '0.02', '0.50');
  if (!paid) return;

  try {
    const { noticeId } = req.body || {};
    if (!noticeId) return res.status(400).json({ ok: false, error: 'noticeId required' });
    const result = await getOpportunityDetails(noticeId);
    res.json({ ok: true, opportunity: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
