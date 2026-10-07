const DAY_MS = 24 * 60 * 60_000;

export const GTM = {
	market: "IN",
	periodMinDays: 364,
	periodMaxDays: 366,
	dayMs: DAY_MS,
	minimumAverageCapacityPb: 1,
	maxCampaigns: 100,
	maxVisibleAgentRuns: 500,
	maxProposalExamples: 100,
} as const;
