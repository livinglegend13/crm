const KIB = 1024;

export const RESEARCH = {
	web: {
		maxUrlChars: 2000,
		timeoutMs: 10_000,
		maxBytes: 200 * KIB,
		maxChars: 30_000,
	},
} as const;
