// SAM.gov API wrapper — structured data for agents
const SAM_BASE = 'https://api.sam.gov/opportunities/v2/search';

async function searchOpportunities({ keywords = '', naics = '', agency = '', minValue = 0, maxValue = 0, limit = 10 } = {}) {
  const params = new URLSearchParams({
    api_key: process.env.SAM_API_KEY,
    q: keywords || '*',
    limit: Math.min(limit, 25),
    offset: 0,
    active: 'Yes',
    postedFrom: getDateOffset(90),
    postedTo: getDateOffset(0),
  });

  if (naics) params.set('naicsCode', naics);
  if (agency) params.set('organizationName', agency);

  const url = `${SAM_BASE}?${params}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'AegisGovAI-MCP/1.0' } });

  if (!res.ok) throw new Error(`SAM.gov error: ${res.status}`);
  const data = await res.json();

  const opps = (data.opportunitiesData || []).map(o => ({
    noticeId: o.noticeId,
    title: o.title,
    agency: o.departmentName || o.organizationName,
    type: o.type,
    postedDate: o.postedDate,
    responseDeadline: o.responseDeadLine,
    naicsCode: o.naicsCode,
    setAside: o.typeOfSetAside,
    placeOfPerformance: o.placeOfPerformanceState,
    contractValue: o.award?.amount || null,
    solicitationNumber: o.solicitationNumber,
    active: o.active,
  }));

  return {
    total: data.totalRecords || opps.length,
    count: opps.length,
    opportunities: opps,
  };
}

async function getOpportunityDetails(noticeId) {
  const params = new URLSearchParams({
    api_key: process.env.SAM_API_KEY,
    noticeid: noticeId,
  });

  const url = `${SAM_BASE}?${params}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'AegisGovAI-MCP/1.0' } });
  if (!res.ok) throw new Error(`SAM.gov error: ${res.status}`);

  const data = await res.json();
  const o = (data.opportunitiesData || [])[0];
  if (!o) throw new Error(`Notice ${noticeId} not found`);

  return {
    noticeId: o.noticeId,
    title: o.title,
    description: o.description,
    agency: o.departmentName || o.organizationName,
    subAgency: o.subtierName,
    office: o.officeName,
    type: o.type,
    postedDate: o.postedDate,
    responseDeadline: o.responseDeadLine,
    archiveDate: o.archiveDate,
    naicsCode: o.naicsCode,
    naicsDescription: o.naicsDescription,
    setAside: o.typeOfSetAside,
    placeOfPerformance: {
      city: o.placeOfPerformanceCity,
      state: o.placeOfPerformanceState,
      country: o.placeOfPerformanceCountry,
    },
    contractValue: o.award?.amount || null,
    solicitationNumber: o.solicitationNumber,
    pointOfContact: (o.pointOfContact || []).map(p => ({
      name: p.fullName,
      email: p.email,
      phone: p.phone,
    })),
    links: (o.resourceLinks || []),
    active: o.active,
  };
}

async function analyzeBidPotential(noticeId) {
  const details = await getOpportunityDetails(noticeId);

  // Local Ollama analysis — zero cost
  const prompt = `Analyze this government contract opportunity for bid potential. Be concise and specific.

Title: ${details.title}
Agency: ${details.agency}
NAICS: ${details.naicsCode} - ${details.naicsDescription}
Set-Aside: ${details.setAside || 'None'}
Value: ${details.contractValue || 'Not stated'}
Deadline: ${details.responseDeadline}
Description (excerpt): ${(details.description || '').slice(0, 500)}

Return JSON only:
{
  "score": 0-100,
  "recommendation": "BID" | "NO-BID" | "MONITOR",
  "strengths": ["..."],
  "risks": ["..."],
  "competitionLevel": "LOW" | "MEDIUM" | "HIGH",
  "estimatedValue": "...",
  "summary": "2-3 sentence analysis"
}`;

  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen2.5:7b', prompt, stream: false, format: 'json' }),
  });

  if (!res.ok) throw new Error('Analysis service unavailable');
  const result = await res.json();

  let analysis = {};
  try { analysis = JSON.parse(result.response); } catch { analysis = { summary: result.response }; }

  return { noticeId, details, analysis };
}

function getDateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

module.exports = { searchOpportunities, getOpportunityDetails, analyzeBidPotential };
