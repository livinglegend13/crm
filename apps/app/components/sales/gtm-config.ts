const SECOND_MS = 1000;

export const GTM_VIEW = {
	poll: { activeMs: 5 * SECOND_MS, readyMs: 15 * SECOND_MS },
	material: { maxFileBytes: 2_000_000, maxCharacters: 100_000 },
} as const;
