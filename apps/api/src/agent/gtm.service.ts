import type { Db, Prisma } from "@crm/db";
import { agentRunResult } from "@crm/validation/agent-run-result";
import type {
	AddCampaignTargetInput,
	CreateCampaignInput,
	ProspectsInput,
	RemoveCampaignTargetInput,
	RunCampaignAgentInput,
	SaveCampaignStepsInput,
	SaveFiloReviewInput,
	UpdateCampaignInput,
} from "@crm/validation/gtm";
import { campaignAgentRunInput } from "@crm/validation/gtm";
import { draftFieldsFromRunResult } from "@crm/validation/outreach-draft";
import {
	BadRequestException,
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

	async prospects(userId: string, input: ProspectsInput) {
		await this.access.assertMember(userId);
		const and: Prisma.CompanyWhereInput[] = [india, { archivedAt: null }];
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
		if (input.decision === "EVIDENCE_NEEDED") {
			and.push({
				OR: [
					{ filoReview: { is: null } },
					{ filoReview: { is: { decision: "EVIDENCE_NEEDED" } } },
				],
			});
		} else if (input.decision !== "ALL") {
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
			include: { _count: { select: { steps: true, targets: true } } },
		});
		const qualified = await Promise.all(
			rows.map((row) =>
				this.db.gtmCampaignTarget.count({
					where: {
						campaignId: row.id,
						company: { filoReview: { is: { decision: "MEETS_GATE" } } },
					},
				}),
			),
		);
		return rows.map((row, index) => ({
			id: row.id,
			name: row.name,
			description: row.description,
			status: row.status,
			marketCountryCode: "IN" as const,
			schedule: {
				timeZone: "Asia/Kolkata" as const,
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
			const parsed = campaignAgentRunInput.parse(run.input);
			const previous = runsByTarget.get(parsed.campaignTargetId) ?? [];
			if (!previous.some((entry) => entry.agentId === run.agentId)) {
				previous.push(run);
				runsByTarget.set(parsed.campaignTargetId, previous);
			}
		}
		return {
			id: row.id,
			name: row.name,
			description: row.description,
			status: row.status,
			marketCountryCode: "IN" as const,
			schedule: {
				timeZone: "Asia/Kolkata" as const,
				sendDays: row.sendDays,
				startMinute: row.startMinute,
				endMinute: row.endMinute,
			},
			targetCount: row.targets.length,
			qualifiedCount: row.targets.filter(
				(target) => target.company.filoReview?.decision === "MEETS_GATE",
			).length,
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
				decision: target.company.filoReview?.decision ?? "EVIDENCE_NEEDED",
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
				})),
			})),
		};
	}

	async runTargetAgent(userId: string, input: RunCampaignAgentInput) {
		await this.access.assertMember(userId);
		const target = await this.db.gtmCampaignTarget.findFirst({
			where: {
				id: input.targetId,
				campaignId: input.id,
				company: { archivedAt: null, AND: [india] },
			},
			select: {
				id: true,
				companyId: true,
				company: { select: { name: true } },
				contact: { select: { firstName: true, lastName: true, email: true } },
				campaign: {
					select: {
						id: true,
						name: true,
						description: true,
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
			steps: target.campaign.steps,
		});
		const run = await this.runs.runNow(
			{ id: input.agentId, clientRequestId: input.clientRequestId },
			userId,
			runInput,
		);
		return { runId: run.id };
	}

	async createCampaign(userId: string, input: CreateCampaignInput) {
		await this.access.assertMember(userId);
		const row = await this.db.gtmCampaign.create({
			data: {
				name: input.name,
				description: input.description,
				ownerId: userId,
			},
		});
		return this.campaign(userId, row.id);
	}

	async updateCampaign(userId: string, input: UpdateCampaignInput) {
		await this.access.assertMember(userId);
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
				description: input.description,
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
			select: { id: true },
		});
		if (!campaign) throw new NotFoundException("Campaign not found.");
		const company = await this.db.company.findFirst({
			where: { id: input.companyId, archivedAt: null, AND: [india] },
			select: { id: true },
		});
		if (!company)
			throw new NotFoundException("This India company is unavailable.");
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
