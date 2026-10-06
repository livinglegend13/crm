import { z } from "zod";
import { agentRunResult } from "./agent-run-result";

export const outreachDraft = z.object({
	runId: z.string(),
	agentId: z.string(),
	agentName: z.string(),
	recipientEmail: z.string().nullable(),
	subject: z.string(),
	body: z.string(),
	status: z.enum(["DRAFT", "APPROVED"]),
	approvedAt: z.string().nullable(),
	researchSummary: z.string().nullable(),
	researchSources: z.string().nullable(),
	researchFacts: z.string().nullable(),
	researchUnknowns: z.string().nullable(),
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

export const approveOutreachDraftInput = z.object({
	runId: z.string().min(1),
	expectedUpdatedAt: z.iso.datetime(),
});

export type OutreachDraft = z.infer<typeof outreachDraft>;
export type SaveOutreachDraftInput = z.infer<typeof saveOutreachDraftInput>;
export type ApproveOutreachDraftInput = z.infer<
	typeof approveOutreachDraftInput
>;

export function draftFieldsFromRunResult(value: unknown) {
	const result = agentRunResult.parse(value);
	const subject = result["Approval-ready email subject"] ?? result.emailSubject;
	const body = result["Approval-ready email body"] ?? result.emailBody;
	return typeof subject === "string" && typeof body === "string"
		? { subject, body }
		: null;
}

export function draftResearchFromRunResult(value: unknown) {
	const result = agentRunResult.parse(value);
	const read = (key: string) =>
		typeof result[key] === "string" ? (result[key] as string) : null;
	return {
		researchSources: read("Sources"),
		researchFacts:
			[read("CRM facts"), read("Public facts")].filter(Boolean).join("\n\n") ||
			null,
		researchUnknowns: read("Unknowns"),
	};
}
