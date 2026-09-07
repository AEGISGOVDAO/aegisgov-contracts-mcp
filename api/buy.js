// api/buy.js — Redirect to Stripe payment link for Contracts MCP API access

'use strict';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Redirect to the Stripe payment link
  const paymentLink = 'https://buy.stripe.com/28E6oH9pg5Zi9d8cSg5Vu07'; // Contracts MCP payment link
  return res.redirect(302, paymentLink);
};
