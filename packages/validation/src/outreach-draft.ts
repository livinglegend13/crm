import { z } from "zod";
import { agentRunResult } from "./agent-run-result";
import { campaignAgentRunInput } from "./gtm";

export const outreachDraft = z.object({
	runId: z.string(),
	agentId: z.string(),
	agentName: z.string(),
	recipientEmail: z.string().nullable(),
	subject: z.string(),
	body: z.string(),
	senderEmail: z.string().nullable(),
	status: z.enum(["DRAFT", "APPROVED", "SENDING", "SENT", "SEND_UNKNOWN"]),
	approvedAt: z.string().nullable(),
	sendStartedAt: z.string().nullable(),
	sentAt: z.string().nullable(),
	sendError: z.string().nullable(),
	researchSummary: z.string().nullable(),
	researchSources: z.string().nullable(),
	researchFacts: z.string().nullable(),
	researchUnknowns: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string().nullable(),
});

export const outreachDraftList = z.array(outreachDraft);

export const outreachStats = z.object({
	drafts: z.number().int(),
	approved: z.number().int(),
	sent: z.number().int(),
	replies: z.number().int(),
	agentRuns: z.number().int(),
	failedRuns: z.number().int(),
});

export const saveOutreachDraftInput = z.object({
	runId: z.string().min(1),
	recipientEmail: z.union([z.email(), z.literal("")]),
	subject: z.string().trim().min(1).max(300),
	body: z.string().trim().min(1).max(20_000),
	senderEmail: z.email().nullable(),
});

export const approveOutreachDraftInput = z.object({
	runId: z.string().min(1),
	expectedUpdatedAt: z.iso.datetime(),
});

export const sendOutreachDraftInput = approveOutreachDraftInput;

export const regenerateOutreachDraftInput = z.object({
	runId: z.string().min(1),
	pointers: z.string().trim().min(3).max(3000),
	clientRequestId: z.uuid(),
});

export const regenerateOutreachDraftOutput = z.object({ runId: z.string() });

export const outreachRevisionRequest = z.object({
	kind: z.literal("outreach-revision"),
	sourceRunId: z.string(),
	pointers: z.string(),
	previousSubject: z.string(),
	previousBody: z.string(),
	recipientEmail: z.string().nullable(),
	researchSummary: z.string().nullable(),
	researchSources: z.string().nullable(),
	researchFacts: z.string().nullable(),
	researchUnknowns: z.string().nullable(),
});

export function recipientFromRunInput(value: unknown) {
	const campaign = campaignAgentRunInput.safeParse(value);
	if (campaign.success) return campaign.data.recipientEmail;
	const kind = z.object({ kind: z.literal("outreach-revision") });
	if (!kind.safeParse(value).success) return null;
	return outreachRevisionRequest.parse(value).recipientEmail;
}

export const outreachSendersOutput = z.object({
	addresses: z.array(z.email()),
	sendingEnabled: z.boolean(),
	replyAlertsEnabled: z.boolean(),
	pendingReplyAlerts: z.number().int(),
	unknownReplyAlerts: z.number().int(),
	recommendedSender: z.email().nullable(),
	rotation: z.object({
		maxPerMailboxPerDay: z.number().int(),
		minimumGapMinutes: z.number().int(),
	}),
	connected: z.boolean(),
	readConnected: z.boolean(),
	mailboxes: z.array(
		z.object({
			address: z.email(),
			sentLast24Hours: z.number().int(),
			available: z.boolean(),
			status: z.string().nullable(),
			lastSyncedAt: z.string().nullable(),
			lastError: z.string().nullable(),
		}),
	),
	reason: z.string().nullable(),
});

export const sendOutreachDraftOutput = z.object({
	status: z.enum(["APPROVED", "SENT", "SEND_UNKNOWN"]),
	sentAt: z.string().nullable(),
	error: z.string().nullable(),
});

export type OutreachDraft = z.infer<typeof outreachDraft>;
export type SaveOutreachDraftInput = z.infer<typeof saveOutreachDraftInput>;
export type ApproveOutreachDraftInput = z.infer<
	typeof approveOutreachDraftInput
>;
export type SendOutreachDraftInput = z.infer<typeof sendOutreachDraftInput>;
export type RegenerateOutreachDraftInput = z.infer<
	typeof regenerateOutreachDraftInput
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
		researchSources: read("Sources") ?? read("Evidence"),
		researchFacts:
			[read("CRM facts"), read("Public facts")].filter(Boolean).join("\n\n") ||
			read("Findings"),
		researchUnknowns: read("Unknowns"),
	};
}
