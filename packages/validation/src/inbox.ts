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

export const inboxThread = inboxThreadSummary.extend({
	messages: z.array(inboxMessage),
});
