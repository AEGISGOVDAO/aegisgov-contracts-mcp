// Simple event logger for x402 payment events
// Logs to console (captured by Vercel logs)

async function logEvent(event, tool, meta = {}) {
  try {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      event,
      tool,
      ...meta,
    }));
  } catch (e) {
    // silent
  }
}

module.exports = { logEvent };
