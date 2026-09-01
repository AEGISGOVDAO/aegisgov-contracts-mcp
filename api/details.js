module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // get_opportunity_details is FREE
  try {
    const { noticeId } = req.body || {};
    if (!noticeId) return res.status(400).json({ ok: false, error: 'noticeId required' });
    const result = await getOpportunityDetails(noticeId);
    res.json({ ok: true, opportunity: result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
