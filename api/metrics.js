/**
 * GET /metrics — public funnel metrics for aegisgov-contracts-mcp
 *
 * Returns JSON with:
 *   - tool call counts (24h, 14d, all-time rankings)
 *   - HTTP 402 response counts
 *   - payment attempt / success counts
 *   - unique client IP count
 *   - top referrer/discovery sources
 */

'use strict';

const SERVER = 'contracts';
const TOOLS  = ['search_opportunities', 'get_opportunity_details', 'analyze_bid_potential'];
const UPSTASH_URL   = process.env.UPSTASH_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;

/** Execute a single Upstash REST command. */
async function cmd(...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(UPSTASH_URL, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(args),
  });
  const j = await res.json();
  return j.result ?? null;
}

/** Execute a pipeline of Upstash commands, returns array of results. */
async function pipeline(cmds) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return cmds.map(() => null);
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(cmds),
  });
  const arr = await res.json();
  return arr.map(r => r.result ?? null);
}

/** Return an array of YYYY-MM-DD strings for the last N days (UTC). */
function lastNDays(n) {
  const days = [];
  const now  = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.json({ ok: false, error: 'Telemetry not configured (missing UPSTASH_URL/UPSTASH_TOKEN)' });
  }

  try {
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = lastNDays(2)[1];
    const days14    = lastNDays(14);

    // ── Build pipeline: all daily keys ────────────────────────────────────

    const batch = [];

    // Tool calls — today + yesterday (24h proxy) and 14d
    const toolCallKeys = [];
    for (const day of days14) {
      for (const tool of TOOLS) {
        const key = `${SERVER}:call:${day}:${tool}`;
        toolCallKeys.push({ day, tool, key });
        batch.push(['GET', key]);
      }
    }

    // Status codes — 14d
    const statusKeys = [];
    for (const day of days14) {
      for (const code of ['200', '402', '500']) {
        const key = `${SERVER}:status:${day}:${code}`;
        statusKeys.push({ day, code, key });
        batch.push(['GET', key]);
      }
    }

    // Payment events — 14d
    const payAttemptKeys = [];
    const paySuccessKeys = [];
    for (const day of days14) {
      payAttemptKeys.push(`${SERVER}:pay:attempt:${day}`);
      paySuccessKeys.push(`${SERVER}:pay:success:${day}`);
      batch.push(['GET', `${SERVER}:pay:attempt:${day}`]);
      batch.push(['GET', `${SERVER}:pay:success:${day}`]);
    }

    const results = await pipeline(batch);

    // ── Parse results ──────────────────────────────────────────────────────

    let idx = 0;

    // Tool calls
    const toolByDay  = {}; // { day: { tool: count } }
    const toolTotals = {}; // { tool: count_14d }
    for (const { day, tool } of toolCallKeys) {
      const count = parseInt(results[idx++] || 0, 10);
      if (!toolByDay[day])  toolByDay[day]  = {};
      toolByDay[day][tool] = count;
      toolTotals[tool]     = (toolTotals[tool] || 0) + count;
    }

    // Status codes
    const statusByDay  = {}; // { day: { code: count } }
    const statusTotals = {}; // { code: count_14d }
    for (const { day, code } of statusKeys) {
      const count = parseInt(results[idx++] || 0, 10);
      if (!statusByDay[day])   statusByDay[day]   = {};
      statusByDay[day][code]   = count;
      statusTotals[code]       = (statusTotals[code] || 0) + count;
    }

    // Payment events
    let payAttempt14d = 0;
    let paySuccess14d = 0;
    for (let i = 0; i < days14.length; i++) {
      payAttempt14d += parseInt(results[idx++] || 0, 10);
      paySuccess14d += parseInt(results[idx++] || 0, 10);
    }

    // 24h window = today + yesterday
    const today24hTools   = {};
    const yesterday24h    = {};
    for (const tool of TOOLS) {
      today24hTools[tool]  = toolByDay[today]?.[tool]     || 0;
      yesterday24h[tool]   = toolByDay[yesterday]?.[tool] || 0;
    }
    const calls24h = TOOLS.reduce((s, t) => s + today24hTools[t] + yesterday24h[t], 0);

    // ── Async non-batched: unique IPs, top tools (sorted set), top refs ───

    const [uniqueIPs, topToolsRaw, topRefsRaw, payAttemptToday, paySuccessToday] = await Promise.all([
      cmd('SCARD', `${SERVER}:ips`),
      cmd('ZRANGE', `${SERVER}:tools`, '+inf', '-inf', 'BYSCORE', 'REV', 'LIMIT', 0, 10, 'WITHSCORES'),
      cmd('ZRANGE', `${SERVER}:refs`,  '+inf', '-inf', 'BYSCORE', 'REV', 'LIMIT', 0, 9,  'WITHSCORES'),
      cmd('GET', `${SERVER}:pay:attempt:${today}`),
      cmd('GET', `${SERVER}:pay:success:${today}`),
    ]);

    // Parse sorted-set pairs [member, score, member, score, ...]
    const topTools = _parsePairs(topToolsRaw);
    const topRefs  = _parsePairs(topRefsRaw);

    const calls14d = Object.values(toolTotals).reduce((s, v) => s + v, 0);

    return res.json({
      ok:      true,
      server:  'aegisgov-contracts-mcp',
      asOf:    new Date().toISOString(),
      funnel: {
        github: {
          note: 'Pull from /metrics is live traffic only; GitHub clones tracked separately via gh CLI',
        },
        calls: {
          last24h:  calls24h,
          last14d:  calls14d,
          byTool14d: toolTotals,
        },
        topTools,
        http402: {
          last14d: statusTotals['402'] || 0,
          last24h: (statusByDay[today]?.['402'] || 0) + (statusByDay[yesterday]?.['402'] || 0),
        },
        payments: {
          attempts14d: payAttempt14d,
          attempts24h: parseInt(payAttemptToday || 0, 10),
          successes14d: paySuccess14d,
          successes24h: parseInt(paySuccessToday || 0, 10),
          conversionRate: payAttempt14d > 0
            ? `${((paySuccess14d / payAttempt14d) * 100).toFixed(1)}%`
            : 'N/A',
        },
        uniqueClients: parseInt(uniqueIPs || 0, 10),
        topSources: topRefs,
      },
    });

  } catch (err) {
    console.error('[metrics] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/** Convert [member, score, member, score, ...] flat array to [{name, count}] list. */
function _parsePairs(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ name: raw[i], count: parseInt(raw[i + 1] || 0, 10) });
  }
  return out;
}
