import { z } from "zod";

export const businessCardExtraction = z.object({
	firstName: z.string().trim().min(1).max(120),
	lastName: z.string().trim().max(120).nullable(),
	companyName: z.string().trim().min(1).max(200),
	email: z.email().nullable(),
	phone: z.string().trim().max(80).nullable(),
	title: z.string().trim().max(160).nullable(),
	website: z.url().nullable(),
	countryCode: z.string().trim().length(2).nullable(),
});

export type BusinessCardExtraction = z.infer<typeof businessCardExtraction>;

export const businessCardMatchCandidate = z.object({
	id: z.string(),
	name: z.string(),
	companyName: z.string(),
	email: z.string().nullable(),
	reason: z.enum(["email", "phone", "name"]),
});

export const businessCardMatchCandidates = z.array(businessCardMatchCandidate);

export const businessCardRequest = z.object({
	recentlyMet: z.boolean(),
	autoSend: z.boolean(),
	meetingNote: z.string().trim().max(5000).nullable(),
});

export const confirmBusinessCardInput = z.object({
	id: z.string().min(1),
	existingContactId: z.string().nullable(),
	extraction: businessCardExtraction,
	meetingNote: z.string().trim().max(5000).nullable(),
	recentlyMet: z.boolean(),
	autoSend: z.boolean(),
});

export function businessCardThankYou(firstName: string, senderName: string) {
	return {
		subject: "Good meeting you",
		body: `Hi ${firstName},\n\nIt was a pleasure meeting you. Thank you for taking the time to speak with me.\n\nI would welcome a short conversation to explore where Terraeagle's cybersecurity, AI, and FinOps work could support your priorities. Would a 20-minute call next week suit you?\n\nRegards,\n${senderName}\nTerraeagle`,
	};
}
