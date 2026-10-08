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
	campaignId: z.string().optional(),
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
export const campaignServiceLine = z.enum([
	"FILO_STORAGE",
	"CYBERSECURITY",
	"AI",
	"FINOPS",
	"CUSTOM",
]);

export const marketCountryCode = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z]{2}$/);
export const gtmServiceEntry = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	description: z.string(),
	qualificationGuidance: z.string(),
	marketCountryCodes: z.array(marketCountryCode),
	legacyLine: campaignServiceLine.nullable(),
	active: z.boolean(),
});
export const gtmServices = z.array(gtmServiceEntry);
export const saveGtmServiceInput = z.object({
	id: z.string().optional(),
	name: z.string().trim().min(2).max(120),
	description: z.string().trim().max(3000),
	qualificationGuidance: z.string().trim().max(3000),
	marketCountryCodes: z
		.array(marketCountryCode)
		.min(1)
		.max(30)
		.refine((codes) => new Set(codes).size === codes.length),
	active: z.boolean(),
});
export type SaveGtmServiceInput = z.infer<typeof saveGtmServiceInput>;

export function campaignCallSubject(
	companyName: string,
	contactName: string | null,
) {
	return `Call ${contactName ?? companyName} about ${companyName}`;
}

export const campaignSchedule = z.object({
	timeZone: z.string().trim().min(3).max(80),
	sendDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
	startMinute: z.number().int().min(0).max(1439),
	endMinute: z.number().int().min(1).max(1440),
});

export const campaignSummary = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	sourceFileName: z.string().nullable(),
	sourceLength: z.number().int(),
	status: campaignStatus,
	serviceLine: campaignServiceLine,
	serviceId: z.string(),
	serviceName: z.string(),
	serviceGuidance: z.string(),
	workflowAgentIds: z.array(z.string()),
	workflowVersion: z.number().int().min(1),
	marketCountryCode,
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
	agentRuns: z.array(
		z.object({
			id: z.string(),
			agentId: z.string(),
			status: z.enum([
				"QUEUED",
				"RUNNING",
				"WAITING_FOR_APPROVAL",
				"SUCCEEDED",
				"FAILED",
				"CANCELLED",
			]),
			summary: z.string().nullable(),
			result: z.record(z.string(), z.json()).nullable(),
			errorMessage: z.string().nullable(),
			hasDraft: z.boolean(),
			createdAt: z.string(),
			stepPosition: z.number().int().nullable(),
			workflowStageIndex: z.number().int().nullable(),
		}),
	),
});

export const campaignAgentId = z.enum([
	"terraeagle-sales-company",
	"terraeagle-sales-outbound-strategist",
]);

export const runCampaignAgentInput = z.object({
	id: z.string().min(1),
	targetId: z.string().min(1),
	agentId: campaignAgentId,
	clientRequestId: z.uuid(),
});

export const runCampaignAgentOutput = z.object({ runId: z.string() });

export type RunCampaignAgentInput = z.infer<typeof runCampaignAgentInput>;

export const campaignAgentRunInput = z.object({
	kind: z.literal("campaign-target"),
	campaignId: z.string(),
	campaignTargetId: z.string(),
	companyId: z.string(),
	focus: z.string(),
	contactName: z.string().nullable(),
	recipientEmail: z.email().nullable(),
	campaignName: z.string(),
	campaignBrief: z.string().nullable(),
	serviceLine: campaignServiceLine.default("FILO_STORAGE"),
	serviceId: z.string().optional(),
	serviceName: z.string().optional(),
	serviceGuidance: z.string().optional(),
	marketCountryCode: marketCountryCode.optional(),
	stepPosition: z.number().int().min(0).default(0),
	previousEmail: z
		.object({ subject: z.string(), body: z.string() })
		.nullable()
		.optional(),
	campaignMaterial: z.string().nullable().optional(),
	steps: z.array(
		z.object({
			position: z.number(),
			delayDays: z.number(),
			subjectPrompt: z.string(),
			bodyPrompt: z.string(),
		}),
	),
});

export type CampaignAgentRunInput = z.infer<typeof campaignAgentRunInput>;

export const campaignWorkflowRunInput = z.object({
	kind: z.literal("campaign-workflow"),
	campaignId: z.string(),
	campaignTargetId: z.string(),
	companyId: z.string(),
	focus: z.string(),
	serviceLine: campaignServiceLine,
	serviceId: z.string().optional(),
	serviceName: z.string().optional(),
	serviceGuidance: z.string().optional(),
	marketCountryCode: marketCountryCode.optional(),
	workflowVersion: z.number().int().min(1).optional(),
	campaignBrief: z.string().nullable(),
	campaignMaterial: z.string().nullable(),
	stageIndex: z.number().int().min(0),
	previousSummary: z.string().nullable(),
});

export const campaignWorkflowAgents = z.array(
	z.object({ id: z.string(), name: z.string() }),
);

export const campaignPlanRunInput = z.object({
	kind: z.literal("campaign-plan"),
	serviceLine: campaignServiceLine,
	serviceName: z.string().optional(),
	serviceGuidance: z.string().optional(),
	marketCountryCode: marketCountryCode.optional(),
	campaignName: z.string().trim().min(3).max(120),
	campaignBrief: z.string().trim().max(1000).nullable(),
	campaignMaterial: z.string().trim().min(100).max(100000),
});

export type CampaignPlanRunInput = z.infer<typeof campaignPlanRunInput>;

export const campaignPlan = z.object({
	brief: z.string().trim().min(20).max(3000),
	steps: z
		.array(
			z.object({
				delayDays: z.number().int().min(0).max(90),
				subjectPrompt: z.string().trim().min(3).max(500),
				bodyPrompt: z.string().trim().min(3).max(3000),
			}),
		)
		.min(1)
		.max(5),
});

export const campaignPlanValue = z.union([
	campaignPlan,
	z
		.string()
		.transform((value, context) => {
			try {
				return JSON.parse(value);
			} catch {
				context.addIssue({
					code: "custom",
					message: "Campaign plan is not valid JSON.",
				});
				return z.NEVER;
			}
		})
		.pipe(campaignPlan),
]);

export const requestCampaignPlanInput = campaignPlanRunInput
	.omit({ kind: true, serviceName: true, serviceGuidance: true })
	.extend({
		serviceId: z.string().min(1),
		marketCountryCode,
		clientRequestId: z.uuid(),
	});
export type RequestCampaignPlanInput = z.infer<typeof requestCampaignPlanInput>;
export const campaignPlanRunIdInput = z.object({ runId: z.string().min(1) });
export const campaignPlanStatus = z.object({
	status: z.enum([
		"QUEUED",
		"RUNNING",
		"WAITING_FOR_APPROVAL",
		"SUCCEEDED",
		"FAILED",
		"CANCELLED",
	]),
	errorMessage: z.string().nullable(),
	plan: campaignPlan.nullable(),
});

export const campaignDetail = campaignSummary.extend({
	sourceMaterial: z.string().nullable(),
	steps: z.array(campaignStep),
	targets: z.array(campaignTarget),
});

export const campaignIdInput = z.object({ id: z.string().min(1) });
export const campaignCallTaskInput = campaignIdInput.extend({
	targetId: z.string().min(1),
});
export const campaignCallTaskOutput = z
	.object({ id: z.string(), dueAt: z.string().nullable() })
	.nullable();
export type CampaignCallTaskInput = z.infer<typeof campaignCallTaskInput>;
export const proposalKnowledgeEntry = z.object({
	id: z.string(),
	title: z.string(),
	serviceLine: campaignServiceLine,
	serviceId: z.string(),
	serviceName: z.string(),
	sourceFileName: z.string().nullable(),
	content: z.string(),
	status: z.enum(["DRAFT", "APPROVED", "ARCHIVED"]),
	createdAt: z.string(),
	approvedAt: z.string().nullable(),
});
export const proposalKnowledgeList = z.object({
	rows: z.array(proposalKnowledgeEntry),
	canApprove: z.boolean(),
});
export const addProposalKnowledgeInput = z.object({
	title: z.string().trim().min(3).max(120),
	serviceId: z.string().min(1),
	sourceFileName: z.string().trim().max(255).nullable(),
	content: z.string().trim().min(100).max(100000),
});
export type AddProposalKnowledgeInput = z.infer<
	typeof addProposalKnowledgeInput
>;
export const updateProposalKnowledgeStatusInput = z.object({
	id: z.string().min(1),
	status: z.enum(["APPROVED", "ARCHIVED"]),
});
export type UpdateProposalKnowledgeStatusInput = z.infer<
	typeof updateProposalKnowledgeStatusInput
>;
export const campaignsOutput = z.array(campaignSummary);

export const createCampaignInput = z.object({
	name: z.string().trim().min(3).max(120),
	serviceLine: campaignServiceLine.default("FILO_STORAGE"),
	serviceId: z.string().min(1),
	marketCountryCode,
	description: z.string().trim().max(3000).nullable(),
	sourceFileName: z.string().trim().max(255).nullable().default(null),
	sourceMaterial: z.string().trim().max(100000).nullable().default(null),
	steps: z
		.array(
			z.object({
				delayDays: z.number().int().min(0).max(90),
				subjectPrompt: z.string().trim().min(3).max(500),
				bodyPrompt: z.string().trim().min(3).max(3000),
			}),
		)
		.max(5)
		.default([]),
});

export const updateCampaignInput = campaignIdInput.extend({
	name: z.string().trim().min(3).max(120),
	serviceLine: campaignServiceLine,
	serviceId: z.string().min(1),
	marketCountryCode,
	workflowAgentIds: z
		.array(z.string().min(1))
		.max(19)
		.refine((ids) => new Set(ids).size === ids.length),
	description: z.string().trim().max(3000).nullable(),
	sourceMaterial: z.string().trim().max(100000).nullable(),
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
	marketRows: z.array(
		z.object({
			serviceId: z.string(),
			serviceName: z.string(),
			marketCountryCode,
			companies: z.number().int(),
			campaigns: z.number().int(),
			campaignTargets: z.number().int(),
			qualified: z.number().int(),
		}),
	),
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
