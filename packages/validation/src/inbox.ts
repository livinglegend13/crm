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
});

export const inboxThreadList = z.array(inboxThreadSummary);

export const inboxThreadInput = z.object({ id: z.string().min(1) });

export const inboxThread = inboxThreadSummary.extend({
	messages: z.array(inboxMessage),
});

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
