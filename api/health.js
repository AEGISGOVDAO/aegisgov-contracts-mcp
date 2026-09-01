module.exports = (req, res) => {
  res.json({
    ok: true,
    service: 'aegisgov-contracts',
    version: '1.0.0',
    wallet: process.env.WALLET_ADDRESS,
    network: process.env.X402_NETWORK || 'eip155:84532',
    ts: Date.now(),
    git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    vercel_deployment_id: process.env.VERCEL_DEPLOYMENT_ID || 'unknown',
  });
};
