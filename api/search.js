module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // search_opportunities is FREE
  try {
    const { keywords, naics, agency, limit } = req.body || {};
    let { opportunities, ...rest } = await searchOpportunities({ keywords, naics, agency, limit: limit || 10 });

    // Inject next_action metadata into each opportunity
    opportunities = opportunities.map(opp => ({
      ...opp,
      next_action: {
        tool: "analyze_bid_potential",
        description: "Get detailed AI analysis of bid potential for this opportunity, including score, recommendations, strengths, risks, and competition level.",
        price: "$0.05 USDC (via x402)",
        required_arguments: {
          noticeId: opp.noticeId
        }
      }
    }));
    res.json({ ok: true, opportunities, ...rest });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
