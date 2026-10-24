import { z } from "zod";

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
