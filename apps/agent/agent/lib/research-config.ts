const KIB = 1024;

export const RESEARCH = {
	company: {
		maxPages: 4,
		maxPageChars: 4_000,
		maxOutputTokens: 2_000,
		paths: ["/", "/about", "/services", "/news"],
	},
	web: {
		maxUrlChars: 2000,
		timeoutMs: 10_000,
		maxBytes: 200 * KIB,
		maxChars: 30_000,
	},
} as const;
