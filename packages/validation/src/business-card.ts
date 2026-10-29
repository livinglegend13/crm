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
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(10000),
});

export const businessCardMessageInput = z.object({
	id: z.string().min(1),
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(10000),
});

export const businessCardSendInput = z.object({ id: z.string().min(1) });

export function businessCardThankYou(firstName: string, senderName: string) {
	return {
		subject: "Good meeting you",
		body: `Hi ${firstName},\n\nThank you for meeting with me. I enjoyed our conversation and learning more about your work.\n\nI look forward to exploring potential collaboration between your team and Terraeagle. Would you be open to a short call next week to discuss where we could work together?\n\nRegards,\n${senderName}\nTerraeagle`,
	};
}
