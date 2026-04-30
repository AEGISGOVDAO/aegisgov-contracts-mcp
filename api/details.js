const { getOpportunityDetails } = require('../lib/sam');
const { requirePayment } = require('../lib/x402-handler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const paid = await requirePayment(req, res, '$0.02');
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
