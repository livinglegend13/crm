import { db, type Prisma } from "@crm/db";
import {
	canAutoRunInCampaign,
	parseAgentManifest,
} from "@crm/validation/agent-manifest";
import {
	campaignAgentRunInput,
	campaignWorkflowRunInput,
} from "@crm/validation/gtm";
import { z } from "zod";
import {
	campaignWindowOpen,
	followUpDue,
	nextCampaignAgent,
	nextWorkflowStage,
} from "./campaign-automation-policy";
import { DISPATCH } from "./dispatch-config";

const COMPANY_AGENT = "terraeagle-sales-company";
const OUTBOUND_AGENT = "terraeagle-sales-outbound-strategist";

type CampaignRunRow = {
	agentId: string;
	status: string;
	summary: string | null;
	input: Prisma.JsonValue | null;
	outreachDrafts: Array<{
		id: string;
		status: string;
		sentAt: Date | null;
		subject: string;
		body: string;
	}>;
};

function parseCampaignRunInput(value: Prisma.JsonValue | null) {
	const target = campaignAgentRunInput.safeParse(value);
	if (target.success) return target.data;
	const workflow = campaignWorkflowRunInput.safeParse(value);
	if (workflow.success) return workflow.data;
	throw new Error("A campaign run has invalid input.");
}

function workflowRuns(
	runs: Array<{
		agentId: string;
		status: string;
		input: Prisma.JsonValue | null;
	}>,
) {
	return runs.flatMap((run) => {
		const input = parseCampaignRunInput(run.input);
		return input.kind === "campaign-workflow"
			? [
					{
						agentId: run.agentId,
						status: run.status,
						stageIndex: input.stageIndex,
					},
				]
			: [];
	});
}

function isIndiaCompany(company: {
	countryCode: string | null;
	country: string | null;
}) {
	return (
		company.countryCode?.toUpperCase() === "IN" ||
		Boolean(company.country?.toLowerCase().includes("india"))
	);
}

function eligibleTarget<
	T extends {
		company: {
			archivedAt: Date | null;
			countryCode: string | null;
			country: string | null;
		};
		campaign: {
			sendDays: number[];
			startMinute: number;
			endMinute: number;
			steps: unknown[];
		};
	},
>(target: T | null, now: Date): target is T {
	if (!target) return false;
	if (!campaignWindowOpen(target.campaign, now)) return false;
	if (target.company.archivedAt || !target.campaign.steps.length) return false;
	return isIndiaCompany(target.company);
}

function isLiveAgent<
	T extends { status: string; currentVersionId: string | null },
>(agent: T | undefined): agent is T & { currentVersionId: string } {
	return agent?.status === "LIVE" && Boolean(agent.currentVersionId);
}

async function nextFollowUp(
	tx: Prisma.TransactionClient,
	runs: CampaignRunRow[],
	steps: Array<{ position: number; delayDays: number }>,
	now: Date,
) {
	for (const step of steps.slice(1)) {
		const prior = runs.find(
			(run) =>
				campaignAgentRunInput.parse(run.input).stepPosition ===
				step.position - 1,
		);
		const current = runs.some(
			(run) =>
				campaignAgentRunInput.parse(run.input).stepPosition === step.position,
		);
		const sent = prior?.outreachDrafts.find((draft) => draft.status === "SENT");
		if (!sent) continue;
		const sentDraftIds = runs.flatMap((run) =>
			run.outreachDrafts
				.filter((draft) => draft.status === "SENT")
				.map((draft) => draft.id),
		);
		const hasReply =
			(await tx.outreachReplyAlert.count({
				where: { draftId: { in: sentDraftIds } },
			})) > 0;
		if (followUpDue(sent, step.delayDays, now, hasReply, current))
			return {
				stepPosition: step.position,
				previousEmail: { subject: sent.subject, body: sent.body },
			};
	}
	return null;
}

async function selectTargetRun(
	tx: Prisma.TransactionClient,
	runs: CampaignRunRow[],
	campaign: {
		workflowAgentIds: string[];
		steps: Array<{ position: number; delayDays: number }>;
	},
	hasRecipient: boolean,
	now: Date,
) {
	const research = runs.find((run) => run.agentId === COMPANY_AGENT);
	const outboundRuns = runs.filter((run) => run.agentId === OUTBOUND_AGENT);
	const initialAgent = nextCampaignAgent(
		research?.status,
		outboundRuns.length > 0,
		hasRecipient,
	);
	const progress = nextWorkflowStage(
		research?.status,
		campaign.workflowAgentIds,
		workflowRuns(runs),
	);
	const followUp =
		!initialAgent && progress.complete
			? await nextFollowUp(tx, outboundRuns, campaign.steps, now)
			: null;
	const stepPosition = followUp?.stepPosition ?? 0;
	const agentId =
		initialAgent === COMPANY_AGENT
			? COMPANY_AGENT
			: (progress.next?.agentId ??
				(progress.complete
					? (initialAgent ?? (stepPosition > 0 ? OUTBOUND_AGENT : null))
					: null));
	return {
		agentId,
		progress,
		stepPosition,
		previousEmail: followUp?.previousEmail ?? null,
		previousSummary: progress.next
			? (runs.find((run) => {
					const input = parseCampaignRunInput(run.input);
					return (
						input.kind === "campaign-workflow" &&
						input.stageIndex === progress.next.stageIndex - 1
					);
				})?.summary ??
				research?.summary ??
				null)
			: null,
	};
}
export async function queueCampaignAgentRuns(now = new Date()) {
	let queued = 0;
	let cursor: string | undefined;
	while (queued < DISPATCH.campaign.queuePerTick) {
		const targets = await db.gtmCampaignTarget.findMany({
			where: {
				campaign: { status: "READY", steps: { some: {} } },
				company: {
					archivedAt: null,
					OR: [
						{ countryCode: { equals: "IN", mode: "insensitive" } },
						{ country: { contains: "India", mode: "insensitive" } },
					],
				},
			},
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
			take: DISPATCH.campaign.page,
			cursor: cursor ? { id: cursor } : undefined,
			skip: cursor ? 1 : 0,
			select: {
				id: true,
				contact: { select: { email: true } },
				campaign: {
					select: {
						workflowAgentIds: true,
						sendDays: true,
						startMinute: true,
						endMinute: true,
						steps: {
							orderBy: { position: "asc" },
							select: { position: true, delayDays: true },
						},
					},
				},
			},
		});
		if (targets.length === 0) return queued;
		const agentIds = [
			COMPANY_AGENT,
			OUTBOUND_AGENT,
			...new Set(targets.flatMap((target) => target.campaign.workflowAgentIds)),
		];
		const existing = await db.agentRun.findMany({
			where: {
				agentId: { in: agentIds },
				OR: targets.map((target) => ({
					input: { path: ["campaignTargetId"], equals: target.id },
				})),
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: {
				agentId: true,
				status: true,
				summary: true,
				input: true,
				outreachDrafts: {
					select: {
						id: true,
						status: true,
						sentAt: true,
						subject: true,
						body: true,
					},
				},
			},
		});
		const runsByTarget = new Map<string, typeof existing>();
		for (const run of existing) {
			const targetId = parseCampaignRunInput(run.input).campaignTargetId;
			const runs = runsByTarget.get(targetId) ?? [];
			runs.push(run);
			runsByTarget.set(targetId, runs);
		}
		for (const candidate of targets) {
			if (queued >= DISPATCH.campaign.queuePerTick) break;
			if (!campaignWindowOpen(candidate.campaign, now)) continue;
			const runs = runsByTarget.get(candidate.id) ?? [];
			const researchStatus = runs.find(
				(run) => run.agentId === COMPANY_AGENT,
			)?.status;
			const progress = nextWorkflowStage(
				researchStatus,
				candidate.campaign.workflowAgentIds,
				workflowRuns(runs),
			);
			const firstAgent = nextCampaignAgent(
				researchStatus,
				runs.some((run) => run.agentId === OUTBOUND_AGENT),
				z.email().safeParse(candidate.contact?.email).success,
			);
			if (
				!firstAgent &&
				!progress.next &&
				!runs.some(
					(run) =>
						run.agentId === OUTBOUND_AGENT &&
						run.outreachDrafts.some((draft) => draft.status === "SENT"),
				)
			)
				continue;
			const created = await db.$transaction(async (tx) => {
				const seed = await tx.gtmCampaignTarget.findUnique({
					where: { id: candidate.id },
					select: { campaignId: true },
				});
				if (!seed) return false;
				const [campaign] = z
					.array(
						z.object({
							id: z.string(),
							status: z.enum(["DRAFT", "READY", "PAUSED"]),
						}),
					)
					.parse(
						await tx.$queryRaw<unknown>`
				SELECT id, status FROM "gtmCampaign" WHERE id = ${seed.campaignId} FOR UPDATE
			`,
					);
				if (campaign?.status !== "READY") return false;
				const target = await tx.gtmCampaignTarget.findUnique({
					where: { id: candidate.id },
					select: {
						id: true,
						companyId: true,
						company: {
							select: {
								name: true,
								archivedAt: true,
								countryCode: true,
								country: true,
							},
						},
						contact: {
							select: { firstName: true, lastName: true, email: true },
						},
						campaign: {
							select: {
								id: true,
								name: true,
								description: true,
								sourceMaterial: true,
								serviceLine: true,
								workflowAgentIds: true,
								ownerId: true,
								sendDays: true,
								startMinute: true,
								endMinute: true,
								steps: { orderBy: { position: "asc" } },
							},
						},
					},
				});
				if (!eligibleTarget(target, now)) return false;
				const existing = await tx.agentRun.findMany({
					where: {
						agentId: {
							in: [
								COMPANY_AGENT,
								OUTBOUND_AGENT,
								...target.campaign.workflowAgentIds,
							],
						},
						input: { path: ["campaignTargetId"], equals: target.id },
					},
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					select: {
						agentId: true,
						status: true,
						summary: true,
						input: true,
						outreachDrafts: {
							select: {
								id: true,
								status: true,
								sentAt: true,
								subject: true,
								body: true,
							},
						},
					},
				});
				const {
					agentId,
					progress,
					stepPosition,
					previousEmail,
					previousSummary,
				} = await selectTargetRun(
					tx,
					existing,
					target.campaign,
					z.email().safeParse(target.contact?.email).success,
					now,
				);
				if (!agentId) return false;
				const [agent] = z
					.array(
						z.object({
							id: z.string(),
							status: z.enum([
								"DRAFT",
								"DEPLOYING",
								"LIVE",
								"PAUSED",
								"ARCHIVED",
								"DELETED",
							]),
							currentVersionId: z.string().nullable(),
						}),
					)
					.parse(
						await tx.$queryRaw<unknown>`
				SELECT id, status, "currentVersionId" FROM "agentDefinition"
				WHERE id = ${agentId} FOR UPDATE
			`,
					);
				if (!isLiveAgent(agent)) return false;
				if (progress.next && agentId === progress.next.agentId) {
					const version = await tx.agentVersion.findUniqueOrThrow({
						where: { id: agent.currentVersionId },
						select: { manifest: true },
					});
					if (!canAutoRunInCampaign(parseAgentManifest(version.manifest)))
						return false;
				}
				const active = await tx.agentRun.findFirst({
					where: {
						agentId,
						status: { in: ["QUEUED", "RUNNING", "WAITING_FOR_APPROVAL"] },
					},
					select: { id: true },
				});
				if (active) return false;
				const email = target.contact?.email ?? null;
				const parsedEmail = z.email().safeParse(email);
				const recipientEmail = parsedEmail.success ? parsedEmail.data : null;
				if (agentId === OUTBOUND_AGENT && !recipientEmail) return false;
				const input =
					progress.next && agentId === progress.next.agentId
						? campaignWorkflowRunInput.parse({
								kind: "campaign-workflow",
								campaignId: target.campaign.id,
								campaignTargetId: target.id,
								companyId: target.companyId,
								focus: target.company.name,
								serviceLine: target.campaign.serviceLine,
								campaignBrief: target.campaign.description,
								campaignMaterial: target.campaign.sourceMaterial,
								stageIndex: progress.next.stageIndex,
								previousSummary,
							})
						: campaignAgentRunInput.parse({
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
								recipientEmail,
								campaignName: target.campaign.name,
								campaignBrief: target.campaign.description,
								serviceLine: target.campaign.serviceLine,
								stepPosition,
								previousEmail,
								campaignMaterial: target.campaign.sourceMaterial,
								steps: target.campaign.steps.map((step) => ({
									position: step.position,
									delayDays: step.delayDays,
									subjectPrompt: step.subjectPrompt,
									bodyPrompt: step.bodyPrompt,
								})),
							});
				await tx.agentRun.create({
					data: {
						agentId,
						versionId: agent.currentVersionId,
						initiatedById: target.campaign.ownerId,
						triggerType: "SCHEDULE",
						idempotencyKey:
							progress.next && agentId === progress.next.agentId
								? `campaign:${target.id}:workflow:${progress.next.stageIndex}:${agentId}`
								: `campaign:${target.id}:${agentId}:${stepPosition}`,
						correlationId: crypto.randomUUID(),
						input,
						events: { create: { sequence: 0, type: "run.queued", data: {} } },
					},
				});
				return true;
			});
			if (created) queued += 1;
		}
		cursor = targets.at(-1)?.id;
	}
	return queued;
}
