import { z } from "zod";

export const filoDecision = z.enum([
	"EVIDENCE_NEEDED",
	"MEETS_GATE",
	"BELOW_GATE",
]);

export const filoReview = z.object({
	decision: filoDecision,
	averageCapacityPb: z.number().nullable(),
	periodStart: z.string().nullable(),
	periodEnd: z.string().nullable(),
	evidenceSource: z.string().nullable(),
	evidenceNote: z.string().nullable(),
	buyerContactId: z.string().nullable(),
	updatedAt: z.string(),
});

export const prospectContact = z.object({
	id: z.string(),
	name: z.string(),
	title: z.string().nullable(),
	email: z.string().nullable(),
});

export const prospectRow = z.object({
	companyId: z.string(),
	name: z.string(),
	industry: z.string().nullable(),
	city: z.string().nullable(),
	country: z.string().nullable(),
	contactCount: z.number().int(),
	contacts: z.array(prospectContact),
	review: filoReview.nullable(),
	campaignIds: z.array(z.string()),
});

export const prospectsInput = z.object({
	q: z.string().trim().max(100).default(""),
	decision: z.union([filoDecision, z.literal("ALL")]).default("ALL"),
	offset: z.number().int().min(0).default(0),
	limit: z.number().int().min(1).max(50).default(25),
});

export const prospectsOutput = z.object({
	rows: z.array(prospectRow),
	total: z.number().int(),
});

export const saveFiloReviewInput = z.object({
	companyId: z.string().min(1),
	decision: filoDecision,
	averageCapacityPb: z.number().min(0).nullable(),
	periodStart: z.iso.date().nullable(),
	periodEnd: z.iso.date().nullable(),
	evidenceSource: z.string().trim().max(500).nullable(),
	evidenceNote: z.string().trim().max(3000).nullable(),
	buyerContactId: z.string().nullable(),
});

export const campaignStatus = z.enum(["DRAFT", "READY", "PAUSED"]);

export const campaignSchedule = z.object({
	timeZone: z.literal("Asia/Kolkata"),
	sendDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
	startMinute: z.number().int().min(0).max(1439),
	endMinute: z.number().int().min(1).max(1440),
});

export const campaignSummary = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	status: campaignStatus,
	marketCountryCode: z.literal("IN"),
	schedule: campaignSchedule,
	targetCount: z.number().int(),
	qualifiedCount: z.number().int(),
	stepCount: z.number().int(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const campaignStep = z.object({
	id: z.string(),
	position: z.number().int(),
	delayDays: z.number().int(),
	subjectPrompt: z.string(),
	bodyPrompt: z.string(),
});

export const campaignTarget = z.object({
	id: z.string(),
	companyId: z.string(),
	companyName: z.string(),
	contactId: z.string().nullable(),
	contactName: z.string().nullable(),
	contactEmail: z.string().nullable(),
	decision: filoDecision,
	createdAt: z.string(),
});

export const campaignDetail = campaignSummary.extend({
	steps: z.array(campaignStep),
	targets: z.array(campaignTarget),
});

export const campaignIdInput = z.object({ id: z.string().min(1) });
export const campaignsOutput = z.array(campaignSummary);

export const createCampaignInput = z.object({
	name: z.string().trim().min(3).max(120),
	description: z.string().trim().max(1000).nullable(),
});

export const updateCampaignInput = campaignIdInput.extend({
	name: z.string().trim().min(3).max(120),
	description: z.string().trim().max(1000).nullable(),
	status: campaignStatus,
	schedule: campaignSchedule,
});

export const saveCampaignStepsInput = campaignIdInput.extend({
	steps: z
		.array(
			z.object({
				delayDays: z.number().int().min(0).max(90),
				subjectPrompt: z.string().trim().min(3).max(500),
				bodyPrompt: z.string().trim().min(3).max(3000),
			}),
		)
		.max(5),
});

export const addCampaignTargetInput = campaignIdInput.extend({
	companyId: z.string().min(1),
	contactId: z.string().nullable(),
});

export const removeCampaignTargetInput = campaignIdInput.extend({
	targetId: z.string().min(1),
});

export const gtmInsights = z.object({
	indiaCompanies: z.number().int(),
	reviewsNeeded: z.number().int(),
	qualified: z.number().int(),
	belowGate: z.number().int(),
	campaigns: z.number().int(),
	campaignTargets: z.number().int(),
	drafts: z.number().int(),
	approved: z.number().int(),
	sent: z.number().int(),
	replies: z.number().int(),
});

export type ProspectsInput = z.infer<typeof prospectsInput>;
export type SaveFiloReviewInput = z.infer<typeof saveFiloReviewInput>;
export type CreateCampaignInput = z.infer<typeof createCampaignInput>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignInput>;
export type SaveCampaignStepsInput = z.infer<typeof saveCampaignStepsInput>;
export type AddCampaignTargetInput = z.infer<typeof addCampaignTargetInput>;
export type RemoveCampaignTargetInput = z.infer<
	typeof removeCampaignTargetInput
>;
