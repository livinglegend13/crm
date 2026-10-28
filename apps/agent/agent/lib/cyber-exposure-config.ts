export const CYBER_EXPOSURE = {
	request: { timeoutMs: 12_000, maxBytes: 512_000 },
	contacts: { maxPerCompany: 3 },
	rate: { xposedGapMs: 600, leakCheckGapMs: 1_100 },
	refresh: { days: 7, dayMs: 86_400_000 },
} as const;
