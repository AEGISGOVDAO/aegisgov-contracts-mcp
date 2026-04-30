module.exports = (req, res) => {
  res.json({ ok: true, service: 'aegisgov-contracts', version: '1.0.0', wallet: process.env.WALLET_ADDRESS, network: process.env.X402_NETWORK || 'eip155:84532', ts: Date.now() });
};
