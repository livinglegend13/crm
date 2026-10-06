import { z } from "zod";
import { agentRunResult } from "./agent-run-result";

export const outreachDraft = z.object({
	runId: z.string(),
	agentId: z.string(),
	agentName: z.string(),
	recipientEmail: z.string().nullable(),
	subject: z.string(),
	body: z.string(),
	createdAt: z.string(),
	updatedAt: z.string().nullable(),
});

export const outreachDraftList = z.array(outreachDraft);

export const saveOutreachDraftInput = z.object({
	runId: z.string().min(1),
	recipientEmail: z.union([z.email(), z.literal("")]),
	subject: z.string().trim().min(1).max(300),
	body: z.string().trim().min(1).max(20_000),
});

export type OutreachDraft = z.infer<typeof outreachDraft>;
export type SaveOutreachDraftInput = z.infer<typeof saveOutreachDraftInput>;

export function draftFieldsFromRunResult(value: unknown) {
	const result = agentRunResult.parse(value);
	const subject = result["Approval-ready email subject"];
	const body = result["Approval-ready email body"];
	return typeof subject === "string" && typeof body === "string"
		? { subject, body }
		: null;
}
