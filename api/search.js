const { searchOpportunities } = require('../lib/sam');
const { requirePayment } = require('../lib/x402-handler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const paid = await requirePayment(req, res, '$0.01');
  if (!paid) return;

  try {
    const { keywords, naics, agency, limit } = req.body || {};
    const result = await searchOpportunities({ keywords, naics, agency, limit: limit || 10 });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
