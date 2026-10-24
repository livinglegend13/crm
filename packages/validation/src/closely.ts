import { z } from "zod";

export const closelyWebhook = z.object({
	trigger: z.string().trim().min(1).max(200),
	phone: z.string().max(100).nullish(),
	company: z.string().max(300).nullish(),
	country: z.string().max(200).nullish(),
	jobTitle: z.string().max(300).nullish(),
	lastName: z.string().max(200).nullish(),
	firstName: z.string().max(200).nullish(),
	workEmail: z.email().nullish(),
	directEmail: z.email().nullish(),
	linkedinUrl: z.url().nullish(),
	accountDto: z
		.object({
			email: z.email().nullish(),
			firstName: z.string().max(200).nullish(),
			lastName: z.string().max(200).nullish(),
			campaignsName: z.array(z.string().max(300)).max(50).nullish(),
		})
		.nullish(),
	companyDto: z
		.object({
			name: z.string().max(300).nullish(),
			websiteUrl: z.url().nullish(),
			linkedinUrl: z.url().nullish(),
		})
		.nullish(),
});

export type CloselyWebhook = z.infer<typeof closelyWebhook>;

export const closelyEventTask = z.object({ eventId: z.string().min(1) });

export const closelyEventRow = z.object({
	id: z.string(),
	trigger: z.string(),
	email: z.string().nullable(),
	linkedinUrl: z.string().nullable(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	companyName: z.string().nullable(),
	campaignNames: z.array(z.string()),
	accountEmail: z.string().nullable(),
	accountName: z.string().nullable(),
	contactId: z.string().nullable(),
	receivedAt: z.string(),
});

export const closelyEventList = z.array(closelyEventRow);

export const closelyConnectionStatus = z.object({
	configured: z.boolean(),
	receiving: z.boolean(),
	lastEventAt: z.string().nullable(),
	emailHandoffEnabled: z.boolean(),
	canManage: z.boolean(),
});
