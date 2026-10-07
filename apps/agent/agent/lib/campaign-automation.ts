import { db, type Prisma } from "@crm/db";
import { campaignAgentRunInput } from "@crm/validation/gtm";
import { z } from "zod";
import {
	campaignWindowOpen,
	followUpDue,
	nextCampaignAgent,
} from "./campaign-automation-policy";
import { DISPATCH } from "./dispatch-config";

const COMPANY_AGENT = "terraeagle-sales-company";
const OUTBOUND_AGENT = "terraeagle-sales-outbound-strategist";

function isIndiaCompany(company: {
	countryCode: string | null;
	country: string | null;
}) {
	return (
		company.countryCode?.toUpperCase() === "IN" ||
		Boolean(company.country?.toLowerCase().includes("india"))
	);
}

function isLiveAgent<
	T extends { status: string; currentVersionId: string | null },
>(agent: T | undefined): agent is T & { currentVersionId: string } {
	return agent?.status === "LIVE" && Boolean(agent.currentVersionId);
}

async function nextFollowUp(
	tx: Prisma.TransactionClient,
	runs: Array<{
		input: Prisma.JsonValue | null;
		outreachDrafts: Array<{
			id: string;
			status: string;
			sentAt: Date | null;
			subject: string;
			body: string;
		}>;
	}>,
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
		const existing = await db.agentRun.findMany({
			where: {
				agentId: { in: [COMPANY_AGENT, OUTBOUND_AGENT] },
				OR: targets.map((target) => ({
					input: { path: ["campaignTargetId"], equals: target.id },
				})),
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: {
				agentId: true,
				status: true,
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
			const parsed = campaignAgentRunInput.safeParse(run.input);
			if (!parsed.success) throw new Error("A campaign run has invalid input.");
			const targetId = parsed.data.campaignTargetId;
			const runs = runsByTarget.get(targetId) ?? [];
			runs.push(run);
			runsByTarget.set(targetId, runs);
		}
		for (const candidate of targets) {
			if (queued >= DISPATCH.campaign.queuePerTick) break;
			if (!campaignWindowOpen(candidate.campaign, now)) continue;
			const runs = runsByTarget.get(candidate.id) ?? [];
			const firstAgent = nextCampaignAgent(
				runs.find((run) => run.agentId === COMPANY_AGENT)?.status,
				runs.some((run) => run.agentId === OUTBOUND_AGENT),
				z.email().safeParse(candidate.contact?.email).success,
			);
			if (
				!firstAgent &&
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
								ownerId: true,
								sendDays: true,
								startMinute: true,
								endMinute: true,
								steps: { orderBy: { position: "asc" } },
							},
						},
					},
				});
				if (!target || !campaignWindowOpen(target.campaign, now)) return false;
				if (target.company.archivedAt || !target.campaign.steps.length)
					return false;
				if (!isIndiaCompany(target.company)) return false;
				const existing = await tx.agentRun.findMany({
					where: {
						agentId: { in: [COMPANY_AGENT, OUTBOUND_AGENT] },
						input: { path: ["campaignTargetId"], equals: target.id },
					},
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					select: {
						agentId: true,
						status: true,
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
				const research = existing.find((run) => run.agentId === COMPANY_AGENT);
				const outboundRuns = existing.filter(
					(run) => run.agentId === OUTBOUND_AGENT,
				);
				const initialAgent = nextCampaignAgent(
					research?.status,
					outboundRuns.length > 0,
					z.email().safeParse(target.contact?.email).success,
				);
				let stepPosition = 0;
				let previousEmail: { subject: string; body: string } | null = null;
				if (!initialAgent) {
					const followUp = await nextFollowUp(
						tx,
						outboundRuns,
						target.campaign.steps,
						now,
					);
					if (followUp) {
						stepPosition = followUp.stepPosition;
						previousEmail = followUp.previousEmail;
					}
				}
				const agentId =
					initialAgent ?? (stepPosition > 0 ? OUTBOUND_AGENT : null);
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
				const input = campaignAgentRunInput.parse({
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
						idempotencyKey: `campaign:${target.id}:${agentId}:${stepPosition}`,
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
