module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    serverInfo: {
      name: "aegisgov-contracts",
      version: "1.0.0"
    },
    authentication: {
      required: true,
      schemes: ["x402"]
    },
    tools: [
      {
        name: "search_opportunities",
        description: "Search 33,000+ active US government contract opportunities from SAM.gov. Supports keyword, NAICS code, and agency filters. Returns opportunity titles, IDs, deadlines, agencies, and set-aside types.",
        inputSchema: {
          type: "object",
          properties: {
            keywords: { type: "string", description: "Search keywords e.g. \"cybersecurity managed services\"" },
            naics: { type: "string", description: "NAICS code filter e.g. \"541512\"" },
            agency: { type: "string", description: "Agency name filter e.g. \"Department of Defense\"" },
            limit: { type: "number", description: "Results count 1-25 (default 10)" }
          }
        }
      },
      {
        name: "get_opportunity_details",
        description: "Get complete details for a SAM.gov opportunity including full description, point of contact, response deadline, set-aside type, place of performance, and NAICS code.",
        inputSchema: {
          type: "object",
          required: ["noticeId"],
          properties: {
            noticeId: { type: "string", description: "SAM.gov notice ID from search results" }
          }
        }
      },
      {
        name: "analyze_bid_potential",
        description: "AI-powered bid/no-bid analysis for a government contract. Returns a score (0-100), BID/NO-BID/MONITOR recommendation, key strengths, risks, and estimated competition level.",
        inputSchema: {
          type: "object",
          required: ["noticeId"],
          properties: {
            noticeId: { type: "string", description: "SAM.gov notice ID to analyze" }
          }
        }
      }
    ],
    resources: [],
    prompts: []
  });
};
