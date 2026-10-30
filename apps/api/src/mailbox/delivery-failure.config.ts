const MINUTE_MS = 60_000;

export const DELIVERY_FAILURE = {
	matchWindowMs: 120 * MINUTE_MS,
	candidateLimit: 50,
} as const;
