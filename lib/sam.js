// SAM.gov API — shared lib for Vercel functions
const SAM_BASE = 'https://api.sam.gov/opportunities/v2/search';

function dateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

async function searchOpportunities({ keywords='', naics='', agency='', limit=10 } = {}) {
  const params = new URLSearchParams({
    api_key: process.env.SAM_API_KEY,
    q: keywords || '*',
    limit: Math.min(limit, 25),
    offset: 0,
    active: 'Yes',
    postedFrom: dateOffset(90),
    postedTo: dateOffset(0),
  });
  if (naics) params.set('naicsCode', naics);
  if (agency) params.set('organizationName', agency);

  const res = await fetch(`${SAM_BASE}?${params}`, { headers: { 'User-Agent': 'AegisGovAI-MCP/1.0' } });
  if (!res.ok) throw new Error(`SAM.gov ${res.status}`);
  const data = await res.json();

  return {
    total: data.totalRecords || 0,
    count: (data.opportunitiesData || []).length,
    opportunities: (data.opportunitiesData || []).map(o => ({
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
    })),
  };
}

async function getOpportunityDetails(noticeId) {
  const params = new URLSearchParams({ api_key: process.env.SAM_API_KEY, noticeid: noticeId });
  const res = await fetch(`${SAM_BASE}?${params}`, { headers: { 'User-Agent': 'AegisGovAI-MCP/1.0' } });
  if (!res.ok) throw new Error(`SAM.gov ${res.status}`);
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
    naicsCode: o.naicsCode,
    naicsDescription: o.naicsDescription,
    setAside: o.typeOfSetAside,
    placeOfPerformance: { city: o.placeOfPerformanceCity, state: o.placeOfPerformanceState },
    contractValue: o.award?.amount || null,
    solicitationNumber: o.solicitationNumber,
    pointOfContact: (o.pointOfContact || []).map(p => ({ name: p.fullName, email: p.email, phone: p.phone })),
  };
}

async function analyzeBidPotential(noticeId) {
  const details = await getOpportunityDetails(noticeId);
  const prompt = `Analyze this US government contract for bid potential. Return JSON only.

Title: ${details.title}
Agency: ${details.agency}
NAICS: ${details.naicsCode} - ${details.naicsDescription}
Set-Aside: ${details.setAside || 'None'}
Value: ${details.contractValue || 'Not stated'}
Deadline: ${details.responseDeadline}
Description: ${(details.description || '').slice(0, 600)}

Return: {"score":0-100,"recommendation":"BID"|"NO-BID"|"MONITOR","strengths":[],"risks":[],"competitionLevel":"LOW"|"MEDIUM"|"HIGH","estimatedValue":"...","summary":"2-3 sentences"}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'qwen/qwen2.5-7b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
  const result = await res.json();
  let analysis = {};
  try { analysis = JSON.parse(result.choices[0].message.content); } catch { analysis = { summary: result.choices[0]?.message?.content }; }

  return { noticeId, details, analysis };
}

module.exports = { searchOpportunities, getOpportunityDetails, analyzeBidPotential };
