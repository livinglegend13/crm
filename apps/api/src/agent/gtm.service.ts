import { isWorkspaceAdmin } from "@crm/auth";
import { ActivityType, type Db, type Prisma } from "@crm/db";
import {
	canAutoRunInCampaign,
	parseAgentManifest,
} from "@crm/validation/agent-manifest";
import { agentRunResult } from "@crm/validation/agent-run-result";
import type {
	AddCampaignTargetInput,
	AddProposalKnowledgeInput,
	CampaignCallTaskInput,
	CreateCampaignInput,
	ProspectsInput,
	RemoveCampaignTargetInput,
	RequestCampaignPlanInput,
	RunCampaignAgentInput,
	SaveCampaignStepsInput,
	SaveFiloReviewInput,
	SaveGtmServiceInput,
	UpdateCampaignInput,
	UpdateProposalKnowledgeStatusInput,
} from "@crm/validation/gtm";
import {
	campaignAgentRunInput,
	campaignCallSubject,
	campaignPlanRunInput,
	campaignPlanValue,
	campaignWorkflowRunInput,
} from "@crm/validation/gtm";
import {
	companyInMarket,
	marketName,
	marketTimeZone,
} from "@crm/validation/gtm-market";
import { draftFieldsFromRunResult } from "@crm/validation/outreach-draft";
import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { AgentAccessService } from "./agent-access.service";
import { AgentRunsService } from "./agent-runs.service";
import { GTM } from "./gtm.config";

const india: Prisma.CompanyWhereInput = {
	OR: [
		{ countryCode: { equals: "IN", mode: "insensitive" } },
		{ country: { contains: "India", mode: "insensitive" } },
	],
};

const LEGACY_SERVICE_IDS = {
	FILO_STORAGE: "terraeagle-filo-storage",
	CYBERSECURITY: "terraeagle-cybersecurity",
	AI: "terraeagle-ai",
	FINOPS: "terraeagle-finops",
	CUSTOM: "terraeagle-cybersecurity",
} as const;

function marketCompanies(countryCode: string): Prisma.CompanyWhereInput {
	return {
		OR: [
			{ countryCode: { equals: countryCode, mode: "insensitive" } },
			{ country: { equals: marketName(countryCode), mode: "insensitive" } },
		],
	};
}

function parseCampaignRunInput(value: Prisma.JsonValue | null) {
	const target = campaignAgentRunInput.safeParse(value);
	if (target.success) return target.data;
	const workflow = campaignWorkflowRunInput.safeParse(value);
	if (workflow.success) return workflow.data;
	throw new Error("A campaign run has invalid input.");
}

function reviewOf(review: {
	decision: "EVIDENCE_NEEDED" | "MEETS_GATE" | "BELOW_GATE";
	averageCapacityPb: number | null;
	periodStart: Date | null;
	periodEnd: Date | null;
	evidenceSource: string | null;
	evidenceNote: string | null;
	buyerContactId: string | null;
	updatedAt: Date;
}) {
	return {
		decision: review.decision,
		averageCapacityPb: review.averageCapacityPb,
		periodStart: review.periodStart?.toISOString().slice(0, 10) ?? null,
		periodEnd: review.periodEnd?.toISOString().slice(0, 10) ?? null,
		evidenceSource: review.evidenceSource,
		evidenceNote: review.evidenceNote,
		buyerContactId: review.buyerContactId,
		updatedAt: review.updatedAt.toISOString(),
	};
}

@Injectable()
export class GtmService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AgentAccessService,
		@Inject(AgentRunsService) private readonly runs: AgentRunsService,
	) {}

	async services(userId: string) {
		await this.access.assertMember(userId);
		return this.db.gtmService.findMany({ orderBy: { name: "asc" } });
	}

	async saveService(userId: string, input: SaveGtmServiceInput) {
		const role = await this.access.assertMember(userId);
		if (!isWorkspaceAdmin(role)) {
			throw new ForbiddenException(
				"Only a workspace admin can manage services.",
			);
		}
		const data = {
			name: input.name,
			description: input.description,
			qualificationGuidance: input.qualificationGuidance,
			marketCountryCodes: input.marketCountryCodes,
			active: input.active,
		};
		if (input.id) {
			const current = await this.db.gtmService.findUnique({
				where: { id: input.id },
			});
			if (!current) throw new NotFoundException("Service not found.");
			const readyCampaigns = await this.db.gtmCampaign.count({
				where: {
					serviceId: input.id,
					status: "READY",
					...(input.active
						? { marketCountryCode: { notIn: input.marketCountryCodes } }
						: {}),
				},
			});
			if (readyCampaigns)
				throw new BadRequestException(
					"Pause affected campaigns before removing a country or service.",
				);
			await this.db.gtmService.update({ where: { id: input.id }, data });
		} else {
			const slug = input.name
				.toLowerCase()
				.normalize("NFKD")
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");
			if (!slug)
				throw new BadRequestException(
					"Use a service name with letters or numbers.",
				);
			const existing = await this.db.gtmService.findUnique({ where: { slug } });
			if (existing)
				throw new BadRequestException(
					"A service with this name already exists.",
				);
			await this.db.gtmService.create({ data: { ...data, slug } });
		}
		return this.services(userId);
	}

	private async requireService(serviceId: string, countryCode: string) {
		const service = await this.db.gtmService.findFirst({
			where: {
				id: serviceId,
				active: true,
				marketCountryCodes: { has: countryCode },
			},
		});
		if (!service)
			throw new BadRequestException(
				"This service is unavailable in the selected country.",
			);
		return service;
	}

	async prospects(userId: string, input: ProspectsInput) {
		await this.access.assertMember(userId);
		const campaign = input.campaignId
			? await this.db.gtmCampaign.findUnique({
					where: { id: input.campaignId },
					select: { marketCountryCode: true, serviceLine: true },
				})
			: null;
		if (input.campaignId && !campaign)
			throw new NotFoundException("Campaign not found.");
		const isFilo = !campaign || campaign.serviceLine === "FILO_STORAGE";
		const and: Prisma.CompanyWhereInput[] = [
			marketCompanies(campaign?.marketCountryCode ?? "IN"),
			{ archivedAt: null },
		];
		if (input.q) {
			and.push({
				OR: [
					{ name: { contains: input.q, mode: "insensitive" } },
					{ industry: { contains: input.q, mode: "insensitive" } },
					{
						contacts: {
							some: { email: { contains: input.q, mode: "insensitive" } },
						},
					},
				],
			});
		}
		if (isFilo && input.decision === "EVIDENCE_NEEDED") {
			and.push({
				OR: [
					{ filoReview: { is: null } },
					{ filoReview: { is: { decision: "EVIDENCE_NEEDED" } } },
				],
			});
		} else if (isFilo && input.decision !== "ALL") {
			and.push({ filoReview: { is: { decision: input.decision } } });
		}
		const where: Prisma.CompanyWhereInput = { AND: and };
		const [total, companies] = await Promise.all([
			this.db.company.count({ where }),
			this.db.company.findMany({
				where,
				orderBy: [{ name: "asc" }, { id: "asc" }],
				skip: input.offset,
				take: input.limit,
				select: {
					id: true,
					name: true,
					industry: true,
					city: true,
					country: true,
					filoReview: true,
					contacts: {
						where: { archivedAt: null },
						orderBy: [{ firstName: "asc" }, { id: "asc" }],
						take: 3,
						select: {
							id: true,
							firstName: true,
							lastName: true,
							title: true,
							email: true,
						},
					},
					_count: { select: { contacts: { where: { archivedAt: null } } } },
					gtmTargets: { select: { campaignId: true } },
				},
			}),
		]);
		return {
			total,
			rows: companies.map((company) => ({
				companyId: company.id,
				name: company.name,
				industry: company.industry,
				city: company.city,
				country: company.country,
				contactCount: company._count.contacts,
				contacts: company.contacts.map((contact) => ({
					id: contact.id,
					name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
					title: contact.title,
					email: contact.email,
				})),
				review: company.filoReview ? reviewOf(company.filoReview) : null,
				campaignIds: company.gtmTargets.map((target) => target.campaignId),
			})),
		};
	}

	async saveReview(userId: string, input: SaveFiloReviewInput) {
		await this.access.assertMember(userId);
		const company = await this.db.company.findFirst({
			where: { id: input.companyId, archivedAt: null, AND: [india] },
			select: { id: true },
		});
		if (!company)
			throw new NotFoundException("This India company is unavailable.");
		if (input.buyerContactId) {
			const buyer = await this.db.contact.findFirst({
				where: {
					id: input.buyerContactId,
					companyId: company.id,
					archivedAt: null,
				},
				select: { id: true },
			});
			if (!buyer)
				throw new BadRequestException("Choose a contact at this company.");
		}
		if (input.decision !== "EVIDENCE_NEEDED") {
			if (
				input.averageCapacityPb === null ||
				!input.periodStart ||
				!input.periodEnd ||
				!input.evidenceSource
			) {
				throw new BadRequestException(
					"Record the 12-month average, period, and evidence source before deciding.",
				);
			}
			const days =
				(new Date(input.periodEnd).getTime() -
					new Date(input.periodStart).getTime()) /
				GTM.dayMs;
			if (days < GTM.periodMinDays || days > GTM.periodMaxDays) {
				throw new BadRequestException("Choose a defined 12-month period.");
			}
			if (
				(input.decision === "MEETS_GATE" &&
					input.averageCapacityPb < GTM.minimumAverageCapacityPb) ||
				(input.decision === "BELOW_GATE" &&
					input.averageCapacityPb >= GTM.minimumAverageCapacityPb)
			) {
				throw new BadRequestException(
					"The decision must match the documented 1 PB average-capacity threshold.",
				);
			}
		}
		const review = await this.db.filoProspectReview.upsert({
			where: { companyId: company.id },
			create: {
				companyId: company.id,
				decision: input.decision,
				averageCapacityPb: input.averageCapacityPb,
				periodStart: input.periodStart ? new Date(input.periodStart) : null,
				periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
				evidenceSource: input.evidenceSource,
				evidenceNote: input.evidenceNote,
				buyerContactId: input.buyerContactId,
				reviewedById: userId,
			},
			update: {
				decision: input.decision,
				averageCapacityPb: input.averageCapacityPb,
				periodStart: input.periodStart ? new Date(input.periodStart) : null,
				periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
				evidenceSource: input.evidenceSource,
				evidenceNote: input.evidenceNote,
				buyerContactId: input.buyerContactId,
				reviewedById: userId,
			},
		});
		return reviewOf(review);
	}

	async campaigns(userId: string) {
		await this.access.assertMember(userId);
		const rows = await this.db.gtmCampaign.findMany({
			orderBy: { updatedAt: "desc" },
			take: GTM.maxCampaigns,
			include: {
				service: true,
				_count: { select: { steps: true, targets: true } },
			},
		});
		const qualified = await Promise.all(
			rows.map((row) =>
				row.serviceLine === "FILO_STORAGE"
					? this.db.gtmCampaignTarget.count({
							where: {
								campaignId: row.id,
								company: { filoReview: { is: { decision: "MEETS_GATE" } } },
							},
						})
					: Promise.resolve(0),
			),
		);
		return rows.map((row, index) => ({
			id: row.id,
			name: row.name,
			description: row.description,
			sourceFileName: row.sourceFileName,
			sourceLength: row.sourceMaterial?.length ?? 0,
			status: row.status,
			serviceLine: row.serviceLine,
			serviceId: row.serviceId ?? LEGACY_SERVICE_IDS[row.serviceLine],
			serviceName: row.service?.name ?? row.serviceLine,
			serviceGuidance: row.service?.qualificationGuidance ?? "",
			workflowAgentIds: row.workflowAgentIds,
			workflowVersion: row.workflowVersion,
			marketCountryCode: row.marketCountryCode,
			schedule: {
				timeZone: row.timeZone,
				sendDays: row.sendDays,
				startMinute: row.startMinute,
				endMinute: row.endMinute,
			},
			targetCount: row._count.targets,
			qualifiedCount: qualified[index] ?? 0,
			stepCount: row._count.steps,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		}));
	}

	async campaign(userId: string, id: string) {
		await this.access.assertMember(userId);
		const row = await this.db.gtmCampaign.findUnique({
			where: { id },
			include: {
				service: true,
				steps: { orderBy: { position: "asc" } },
				targets: {
					orderBy: { createdAt: "asc" },
					include: {
						company: {
							select: {
								name: true,
								filoReview: { select: { decision: true } },
							},
						},
						contact: {
							select: { firstName: true, lastName: true, email: true },
						},
					},
				},
			},
		});
		if (!row) throw new NotFoundException("Campaign not found.");
		const recentRuns = await this.db.agentRun.findMany({
			where: {
				agentId: {
					in: [
						"terraeagle-sales-company",
						"terraeagle-sales-outbound-strategist",
						...row.workflowAgentIds,
					],
				},
				input: { path: ["campaignId"], equals: id },
			},
			orderBy: { createdAt: "desc" },
			take: GTM.maxVisibleAgentRuns,
			select: {
				id: true,
				agentId: true,
				status: true,
				summary: true,
				result: true,
				errorMessage: true,
				createdAt: true,
				input: true,
			},
		});
		const runsByTarget = new Map<string, Array<(typeof recentRuns)[number]>>();
		for (const run of recentRuns) {
			const input = parseCampaignRunInput(run.input);
			const targetId = input.campaignTargetId;
			const previous = runsByTarget.get(targetId) ?? [];
			if (
				!previous.some((entry) => {
					const earlier = parseCampaignRunInput(entry.input);
					return (
						entry.agentId === run.agentId &&
						(input.kind === "campaign-workflow"
							? earlier.kind === "campaign-workflow" &&
								earlier.stageIndex === input.stageIndex
							: earlier.kind === "campaign-target" &&
								earlier.stepPosition === input.stepPosition)
					);
				})
			) {
				previous.push(run);
				runsByTarget.set(targetId, previous);
			}
		}
		return {
			id: row.id,
			name: row.name,
			description: row.description,
			sourceFileName: row.sourceFileName,
			sourceLength: row.sourceMaterial?.length ?? 0,
			sourceMaterial: row.sourceMaterial,
			status: row.status,
			serviceLine: row.serviceLine,
			serviceId: row.serviceId ?? LEGACY_SERVICE_IDS[row.serviceLine],
			serviceName: row.service?.name ?? row.serviceLine,
			serviceGuidance: row.service?.qualificationGuidance ?? "",
			workflowAgentIds: row.workflowAgentIds,
			workflowVersion: row.workflowVersion,
			marketCountryCode: row.marketCountryCode,
			schedule: {
				timeZone: row.timeZone,
				sendDays: row.sendDays,
				startMinute: row.startMinute,
				endMinute: row.endMinute,
			},
			targetCount: row.targets.length,
			qualifiedCount:
				row.serviceLine === "FILO_STORAGE"
					? row.targets.filter(
							(target) => target.company.filoReview?.decision === "MEETS_GATE",
						).length
					: 0,
			stepCount: row.steps.length,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			steps: row.steps.map((step) => ({
				id: step.id,
				position: step.position,
				delayDays: step.delayDays,
				subjectPrompt: step.subjectPrompt,
				bodyPrompt: step.bodyPrompt,
			})),
			targets: row.targets.map((target) => ({
				id: target.id,
				companyId: target.companyId,
				companyName: target.company.name,
				contactId: target.contactId,
				contactName: target.contact
					? [target.contact.firstName, target.contact.lastName]
							.filter(Boolean)
							.join(" ")
					: null,
				contactEmail: target.contact?.email ?? null,
				decision:
					row.serviceLine === "FILO_STORAGE"
						? (target.company.filoReview?.decision ?? "EVIDENCE_NEEDED")
						: "EVIDENCE_NEEDED",
				createdAt: target.createdAt.toISOString(),
				agentRuns: (runsByTarget.get(target.id) ?? []).map((run) => ({
					id: run.id,
					agentId: run.agentId,
					status: run.status,
					summary: run.summary,
					result: run.result === null ? null : agentRunResult.parse(run.result),
					errorMessage: run.errorMessage,
					hasDraft:
						run.result !== null &&
						draftFieldsFromRunResult(run.result) !== null,
					createdAt: run.createdAt.toISOString(),
					stepPosition:
						parseCampaignRunInput(run.input).kind === "campaign-target" &&
						run.agentId !== "terraeagle-sales-company"
							? campaignAgentRunInput.parse(run.input).stepPosition
							: null,
					workflowStageIndex:
						campaignWorkflowRunInput.safeParse(run.input).data?.stageIndex ??
						null,
				})),
			})),
		};
	}

	async callTask(userId: string, input: CampaignCallTaskInput) {
		await this.access.assertMember(userId);
		const target = await this.db.gtmCampaignTarget.findFirst({
			where: { id: input.targetId, campaignId: input.id },
			select: {
				companyId: true,
				company: { select: { name: true } },
				contact: { select: { firstName: true, lastName: true } },
			},
		});
		if (!target) throw new NotFoundException("Campaign target not found.");
		const contactName = target.contact
			? [target.contact.firstName, target.contact.lastName]
					.filter(Boolean)
					.join(" ")
			: null;
		const task = await this.db.activity.findFirst({
			where: {
				type: ActivityType.TASK,
				createdById: userId,
				companyId: target.companyId,
				subject: campaignCallSubject(target.company.name, contactName),
				completedAt: null,
			},
			orderBy: { createdAt: "desc" },
			select: { id: true, dueAt: true },
		});
		return task
			? { id: task.id, dueAt: task.dueAt?.toISOString() ?? null }
			: null;
	}

	async proposalKnowledge(userId: string) {
		const role = await this.access.assertMember(userId);
		const rows = await this.db.proposalKnowledge.findMany({
			where: { status: { not: "ARCHIVED" } },
			include: { service: { select: { name: true } } },
			orderBy: { createdAt: "desc" },
			take: GTM.maxProposalExamples,
		});
		return {
			canApprove: isWorkspaceAdmin(role),
			rows: rows.map((row) => ({
				id: row.id,
				title: row.title,
				serviceLine: row.serviceLine,
				serviceId: row.serviceId ?? LEGACY_SERVICE_IDS[row.serviceLine],
				serviceName: row.service?.name ?? row.serviceLine,
				sourceFileName: row.sourceFileName,
				content: row.content,
				status: row.status,
				createdAt: row.createdAt.toISOString(),
				approvedAt: row.approvedAt?.toISOString() ?? null,
			})),
		};
	}

	async workflowAgents(userId: string) {
		await this.access.assertMember(userId);
		const rows = await this.db.agentDefinition.findMany({
			where: { status: "LIVE", currentVersionId: { not: null } },
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				currentVersion: { select: { manifest: true } },
			},
		});
		return rows
			.filter(
				(row) =>
					row.currentVersion &&
					![
						"terraeagle-sales-company",
						"terraeagle-sales-outbound-strategist",
						"terraeagle-marketing-campaign-planner",
					].includes(row.id) &&
					canAutoRunInCampaign(parseAgentManifest(row.currentVersion.manifest)),
			)
			.map((row) => ({ id: row.id, name: row.name }));
	}

	async addProposalKnowledge(userId: string, input: AddProposalKnowledgeInput) {
		await this.access.assertMember(userId);
		const service = await this.db.gtmService.findUnique({
			where: { id: input.serviceId },
		});
		if (!service?.active)
			throw new BadRequestException("Select an active service.");
		await this.db.proposalKnowledge.create({
			data: {
				title: input.title,
				serviceId: service.id,
				serviceLine: service.legacyLine ?? "CUSTOM",
				sourceFileName: input.sourceFileName,
				content: input.content,
				createdById: userId,
			},
		});
		return this.proposalKnowledge(userId);
	}

	async updateProposalKnowledgeStatus(
		userId: string,
		input: UpdateProposalKnowledgeStatusInput,
	) {
		const role = await this.access.assertMember(userId);
		if (!isWorkspaceAdmin(role)) {
			throw new ForbiddenException(
				"Only a workspace admin can approve proposals.",
			);
		}
		const existing = await this.db.proposalKnowledge.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) throw new NotFoundException("Proposal example not found.");
		await this.db.proposalKnowledge.update({
			where: { id: input.id },
			data: {
				status: input.status,
				approvedById: input.status === "APPROVED" ? userId : null,
				approvedAt: input.status === "APPROVED" ? new Date() : null,
			},
		});
		return this.proposalKnowledge(userId);
	}

	async runTargetAgent(userId: string, input: RunCampaignAgentInput) {
		await this.access.assertMember(userId);
		const target = await this.db.gtmCampaignTarget.findFirst({
			where: {
				id: input.targetId,
				campaignId: input.id,
				company: { archivedAt: null },
			},
			select: {
				id: true,
				companyId: true,
				company: { select: { name: true, countryCode: true, country: true } },
				contact: { select: { firstName: true, lastName: true, email: true } },
				campaign: {
					select: {
						id: true,
						name: true,
						description: true,
						sourceMaterial: true,
						serviceLine: true,
						serviceId: true,
						marketCountryCode: true,
						service: { select: { name: true, qualificationGuidance: true } },
						steps: {
							orderBy: { position: "asc" },
							select: {
								position: true,
								delayDays: true,
								subjectPrompt: true,
								bodyPrompt: true,
							},
						},
					},
				},
			},
		});
		if (!target) throw new NotFoundException("Campaign target not found.");
		if (!companyInMarket(target.company, target.campaign.marketCountryCode)) {
			throw new BadRequestException(
				"The company is outside this campaign country.",
			);
		}
		const recipientEmail = z.email().safeParse(target.contact?.email);
		if (
			input.agentId === "terraeagle-sales-outbound-strategist" &&
			(!recipientEmail.success || target.campaign.steps.length === 0)
		) {
			throw new BadRequestException(
				"Choose a buyer contact and save a sequence step before drafting.",
			);
		}
		const runInput = campaignAgentRunInput.parse({
			kind: "campaign-target",
			campaignId: target.campaign.id,
			campaignTargetId: target.id,
			companyId: target.companyId,
			focus: target.company.name,
			contactName: target.contact
				? [target.contact.firstName, target.contact.lastName]
						.filter(Boolean)
						.join(" ")
				: null,
			recipientEmail: recipientEmail.success ? recipientEmail.data : null,
			campaignName: target.campaign.name,
			campaignBrief: target.campaign.description,
			serviceLine: target.campaign.serviceLine,
			serviceId:
				target.campaign.serviceId ??
				LEGACY_SERVICE_IDS[target.campaign.serviceLine],
			serviceName: target.campaign.service?.name ?? target.campaign.serviceLine,
			serviceGuidance: target.campaign.service?.qualificationGuidance ?? "",
			marketCountryCode: target.campaign.marketCountryCode,
			stepPosition: 0,
			campaignMaterial: target.campaign.sourceMaterial,
			steps: target.campaign.steps,
		});
		const run = await this.runs.runNow(
			{ id: input.agentId, clientRequestId: input.clientRequestId },
			userId,
			runInput,
		);
		return { runId: run.id };
	}

	async requestCampaignPlan(userId: string, input: RequestCampaignPlanInput) {
		await this.access.assertMember(userId);
		const service = await this.requireService(
			input.serviceId,
			input.marketCountryCode,
		);
		const run = await this.runs.runNow(
			{
				id: "terraeagle-marketing-campaign-planner",
				clientRequestId: input.clientRequestId,
			},
			userId,
			campaignPlanRunInput.parse({
				kind: "campaign-plan",
				...input,
				serviceLine: service.legacyLine ?? "CUSTOM",
				serviceName: service.name,
				serviceGuidance: service.qualificationGuidance,
			}),
		);
		return { runId: run.id };
	}

	async campaignPlanStatus(userId: string, runId: string) {
		await this.access.assertMember(userId);
		const run = await this.db.agentRun.findFirst({
			where: {
				id: runId,
				initiatedById: userId,
				agentId: "terraeagle-marketing-campaign-planner",
			},
			select: { status: true, errorMessage: true, result: true },
		});
		if (!run) throw new NotFoundException("Campaign plan run not found.");
		const result =
			run.result === null ? null : agentRunResult.parse(run.result);
		const plan =
			result === null
				? null
				: campaignPlanValue.safeParse(result["Campaign plan"]);
		return {
			status: run.status,
			errorMessage:
				run.errorMessage ??
				(run.status === "SUCCEEDED" && plan && !plan.success
					? "Agent output needs revision. Open the agent run to review it."
					: null),
			plan: run.status === "SUCCEEDED" && plan?.success ? plan.data : null,
		};
	}

	async createCampaign(userId: string, input: CreateCampaignInput) {
		await this.access.assertMember(userId);
		const service = await this.requireService(
			input.serviceId,
			input.marketCountryCode,
		);
		const row = await this.db.gtmCampaign.create({
			data: {
				name: input.name,
				serviceLine: service.legacyLine ?? "CUSTOM",
				serviceId: service.id,
				marketCountryCode: input.marketCountryCode,
				timeZone: marketTimeZone(input.marketCountryCode),
				description: input.description,
				sourceFileName: input.sourceFileName,
				sourceMaterial: input.sourceMaterial,
				ownerId: userId,
				steps: {
					create: input.steps.map((step, position) => ({
						position,
						delayDays: step.delayDays,
						subjectPrompt: step.subjectPrompt,
						bodyPrompt: step.bodyPrompt,
					})),
				},
			},
		});
		return this.campaign(userId, row.id);
	}

	async updateCampaign(userId: string, input: UpdateCampaignInput) {
		await this.access.assertMember(userId);
		const service = await this.requireService(
			input.serviceId,
			input.marketCountryCode,
		);
		try {
			new Intl.DateTimeFormat("en", { timeZone: input.schedule.timeZone });
		} catch {
			throw new BadRequestException("Choose a valid time zone.");
		}
		const eligible = new Set(
			(await this.workflowAgents(userId)).map((agent) => agent.id),
		);
		if (input.workflowAgentIds.some((id) => !eligible.has(id))) {
			throw new BadRequestException(
				"Select only live, summary-only team agents for automatic handoffs.",
			);
		}
		if (input.schedule.startMinute >= input.schedule.endMinute) {
			throw new BadRequestException(
				"The sending window must end after it starts.",
			);
		}
		const existing = await this.db.gtmCampaign.findUnique({
			where: { id: input.id },
			include: { _count: { select: { steps: true, targets: true } } },
		});
		if (!existing) throw new NotFoundException("Campaign not found.");
		if (
			existing._count.targets > 0 &&
			(existing.serviceId !== service.id ||
				existing.marketCountryCode !== input.marketCountryCode)
		) {
			throw new BadRequestException(
				"Create a new campaign for another service or country. Existing targets keep their history.",
			);
		}
		if (
			existing.status === "READY" &&
			(existing.serviceId !== service.id ||
				existing.marketCountryCode !== input.marketCountryCode)
		) {
			throw new BadRequestException(
				"Pause the campaign before changing its service or country.",
			);
		}
		const sequenceChanged =
			JSON.stringify(existing.workflowAgentIds) !==
			JSON.stringify(input.workflowAgentIds);
		if (
			existing.status === "READY" &&
			input.status === "READY" &&
			sequenceChanged
		) {
			throw new BadRequestException(
				"Pause the campaign before changing its agent sequence.",
			);
		}
		if (
			input.status === "READY" &&
			(existing._count.steps === 0 || existing._count.targets === 0)
		) {
			throw new BadRequestException(
				"Add a target and a sequence step before marking the plan ready.",
			);
		}
		await this.db.gtmCampaign.update({
			where: { id: input.id },
			data: {
				name: input.name,
				serviceLine: service.legacyLine ?? "CUSTOM",
				serviceId: service.id,
				marketCountryCode: input.marketCountryCode,
				timeZone: input.schedule.timeZone,
				workflowAgentIds: input.workflowAgentIds,
				workflowVersion: sequenceChanged ? { increment: 1 } : undefined,
				description: input.description,
				sourceMaterial: input.sourceMaterial,
				status: input.status,
				sendDays: [...new Set(input.schedule.sendDays)].sort(),
				startMinute: input.schedule.startMinute,
				endMinute: input.schedule.endMinute,
			},
		});
		return this.campaign(userId, input.id);
	}

	async saveSteps(userId: string, input: SaveCampaignStepsInput) {
		await this.access.assertMember(userId);
		const row = await this.db.gtmCampaign.findUnique({
			where: { id: input.id },
			select: { id: true, status: true },
		});
		if (!row) throw new NotFoundException("Campaign not found.");
		if (row.status === "READY" && input.steps.length === 0) {
			throw new BadRequestException(
				"Pause the plan before removing every sequence step.",
			);
		}
		await this.db.$transaction(async (tx) => {
			await tx.gtmCampaignStep.deleteMany({ where: { campaignId: input.id } });
			if (input.steps.length > 0) {
				await tx.gtmCampaignStep.createMany({
					data: input.steps.map((step, position) => ({
						campaignId: input.id,
						position,
						delayDays: step.delayDays,
						subjectPrompt: step.subjectPrompt,
						bodyPrompt: step.bodyPrompt,
					})),
				});
			}
		});
		return this.campaign(userId, input.id);
	}

	async addTarget(userId: string, input: AddCampaignTargetInput) {
		await this.access.assertMember(userId);
		const campaign = await this.db.gtmCampaign.findUnique({
			where: { id: input.id },
			select: { id: true, marketCountryCode: true },
		});
		if (!campaign) throw new NotFoundException("Campaign not found.");
		const company = await this.db.company.findFirst({
			where: {
				id: input.companyId,
				archivedAt: null,
				AND: [marketCompanies(campaign.marketCountryCode)],
			},
			select: { id: true },
		});
		if (!company)
			throw new NotFoundException(
				"This company is unavailable in the campaign country.",
			);
		if (input.contactId) {
			const contact = await this.db.contact.findFirst({
				where: { id: input.contactId, companyId: company.id, archivedAt: null },
				select: { id: true },
			});
			if (!contact)
				throw new BadRequestException("Choose a contact at this company.");
		}
		await this.db.gtmCampaignTarget.upsert({
			where: {
				campaignId_companyId: { campaignId: input.id, companyId: company.id },
			},
			create: {
				campaignId: input.id,
				companyId: company.id,
				contactId: input.contactId,
			},
			update: { contactId: input.contactId },
		});
		return this.campaign(userId, input.id);
	}

	async removeTarget(userId: string, input: RemoveCampaignTargetInput) {
		await this.access.assertMember(userId);
		await this.db.gtmCampaignTarget.deleteMany({
			where: { id: input.targetId, campaignId: input.id },
		});
		return this.campaign(userId, input.id);
	}

	async insights(userId: string) {
		await this.access.assertMember(userId);
		const [campaignRows, serviceRows] = await Promise.all([
			this.db.gtmCampaign.findMany({
				select: {
					id: true,
					serviceId: true,
					serviceLine: true,
					marketCountryCode: true,
					service: { select: { name: true } },
					_count: { select: { targets: true } },
				},
			}),
			this.db.gtmService.findMany({
				where: { active: true },
				select: { id: true, name: true, marketCountryCodes: true },
			}),
		]);
		const markets = new Map<
			string,
			{
				serviceId: string;
				serviceName: string;
				marketCountryCode: string;
				companies: number;
				campaigns: number;
				campaignTargets: number;
				qualified: number;
			}
		>();
		for (const service of serviceRows) {
			for (const marketCountryCode of service.marketCountryCodes) {
				markets.set(`${service.id}:${marketCountryCode}`, {
					serviceId: service.id,
					serviceName: service.name,
					marketCountryCode,
					companies: 0,
					campaigns: 0,
					campaignTargets: 0,
					qualified: 0,
				});
			}
		}
		for (const campaign of campaignRows) {
			const serviceId =
				campaign.serviceId ?? LEGACY_SERVICE_IDS[campaign.serviceLine];
			const key = `${serviceId}:${campaign.marketCountryCode}`;
			const current = markets.get(key) ?? {
				serviceId,
				serviceName: campaign.service?.name ?? campaign.serviceLine,
				marketCountryCode: campaign.marketCountryCode,
				companies: 0,
				campaigns: 0,
				campaignTargets: 0,
				qualified: 0,
			};
			current.campaigns += 1;
			current.campaignTargets += campaign._count.targets;
			if (campaign.serviceLine === "FILO_STORAGE") {
				current.qualified += await this.db.gtmCampaignTarget.count({
					where: {
						campaignId: campaign.id,
						company: { filoReview: { is: { decision: "MEETS_GATE" } } },
					},
				});
			}
			markets.set(key, current);
		}
		const marketRows = await Promise.all(
			[...markets.values()].map(async (market) => ({
				...market,
				companies: await this.db.company.count({
					where: {
						archivedAt: null,
						AND: [marketCompanies(market.marketCountryCode)],
					},
				}),
			})),
		);
		const companyWhere: Prisma.CompanyWhereInput = {
			archivedAt: null,
			AND: [india],
		};
		const [
			indiaCompanies,
			qualified,
			belowGate,
			campaigns,
			campaignTargets,
			drafts,
			approved,
			sent,
			replies,
		] = await Promise.all([
			this.db.company.count({ where: companyWhere }),
			this.db.filoProspectReview.count({
				where: { decision: "MEETS_GATE", company: companyWhere },
			}),
			this.db.filoProspectReview.count({
				where: { decision: "BELOW_GATE", company: companyWhere },
			}),
			this.db.gtmCampaign.count(),
			this.db.gtmCampaignTarget.count(),
			this.db.outreachDraft.count({ where: { userId, status: "DRAFT" } }),
			this.db.outreachDraft.count({ where: { userId, status: "APPROVED" } }),
			this.db.outreachDraft.count({ where: { userId, status: "SENT" } }),
			this.db.outreachReplyAlert.count({ where: { userId } }),
		]);
		return {
			marketRows,
			indiaCompanies,
			reviewsNeeded: indiaCompanies - qualified - belowGate,
			qualified,
			belowGate,
			campaigns,
			campaignTargets,
			drafts,
			approved,
			sent,
			replies,
		};
	}
}
