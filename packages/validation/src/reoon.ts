import { z } from "zod";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const REOON = {
	timeoutMs: 12_000,
	maximumAgeMs: 90 * DAY_MS,
	retryDelayMs: DAY_MS,
	queuePerTick: 5,
	maxPerDay: 100,
	dayMs: DAY_MS,
} as const;

export const reoonResult = z.object({
	email: z.email(),
	status: z.string().min(1).max(100),
	overall_score: z.number().int().min(0).max(100).nullish(),
	is_safe_to_send: z.boolean(),
});

export const emailVerificationRow = z.object({
	contactId: z.string(),
	email: z.email(),
	status: z.string(),
	score: z.number().nullable(),
	safe: z.boolean(),
	checkedAt: z.string(),
});

export const emailVerificationList = z.array(emailVerificationRow);

export const emailVerificationStatus = z.object({
	email: z.email().nullable(),
	state: z.enum([
		"NO_CONTACT",
		"NO_EMAIL",
		"PENDING",
		"CHECKING",
		"SAFE",
		"UNSAFE",
		"FAILED",
	]),
	status: z.string().nullable(),
	score: z.number().int().nullable(),
	safe: z.boolean().nullable(),
	checkedAt: z.string().nullable(),
});
