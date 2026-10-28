import { z } from "zod";

const relatedRecord = z.object({ id: z.string(), name: z.string() });

const inboxMessage = z.object({
	id: z.string(),
	direction: z.enum(["INBOUND", "OUTBOUND"]),
	fromEmail: z.string(),
	fromName: z.string().nullable(),
	snippet: z.string().nullable(),
	body: z.string().nullable(),
	sentAt: z.string(),
	mailboxUrl: z.string().nullable(),
});

export const inboxThreadSummary = z.object({
	id: z.string(),
	subject: z.string().nullable(),
	lastMessageAt: z.string(),
	company: relatedRecord.nullable(),
	contact: relatedRecord.nullable(),
	lastMessage: inboxMessage.nullable(),
	messageCount: z.number(),
	feedback: z.enum(["NOT_RELEVANT", "SPAM"]).nullable(),
});

export const inboxThreadListInput = z.object({
	page: z.number().int().min(1).default(1),
	view: z.enum(["ACTIVE", "HIDDEN"]).default("ACTIVE"),
});

export const inboxThreadList = z.object({
	items: z.array(inboxThreadSummary),
	page: z.number(),
	totalPages: z.number(),
	total: z.number(),
});

export const inboxThreadInput = z.object({ id: z.string().min(1) });

export const inboxThread = inboxThreadSummary.extend({
	messages: z.array(inboxMessage),
});

export const inboxThreadFeedbackInput = z.object({
	threadId: z.string().min(1),
	label: z.enum(["NOT_RELEVANT", "SPAM", "RESTORE"]),
});

export const inboxThreadFeedbackResult = z.object({ updated: z.boolean() });

export const inboxFollowUp = z.object({
	id: z.string(),
	threadId: z.string(),
	subject: z.string().nullable(),
	company: relatedRecord.nullable(),
	contact: relatedRecord.nullable(),
	owner: z.enum(["ME", "CUSTOMER", "NONE", "REVIEW"]),
	reason: z.string(),
	evidenceQuote: z.string().nullable(),
	dueAt: z.string().nullable(),
	dueSource: z.enum(["EXPLICIT", "DEFAULT", "NONE"]),
	confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
	relevance: z.enum(["RELEVANT", "NOT_RELEVANT"]),
	snoozedUntil: z.string().nullable(),
	dismissedAt: z.string().nullable(),
	lastMessageAt: z.string(),
	lastMessage: inboxMessage.nullable(),
});

export const inboxFollowUpList = z.array(inboxFollowUp);

export const inboxFollowUpAction = z.object({
	threadId: z.string().min(1),
	action: z.enum(["DISMISS", "REOPEN", "SNOOZE"]),
	until: z.string().datetime({ offset: true }).optional(),
});

export const inboxFollowUpActionResult = z.object({ updated: z.boolean() });
