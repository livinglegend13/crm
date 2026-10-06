const MINUTE_MS = 60_000;

export const OUTREACH_ROTATION = {
	maxPerMailboxPerDay: 10,
	minimumGapMs: 15 * MINUTE_MS,
	dayMs: 24 * 60 * MINUTE_MS,
} as const;
