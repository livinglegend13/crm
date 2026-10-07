import { db } from "@crm/db";
import { campaignAgentRunInput } from "@crm/validation/gtm";
import { z } from "zod";
import {
	campaignWindowOpen,
	nextCampaignAgent,
} from "./campaign-automation-policy";
import { DISPATCH } from "./dispatch-config";

const COMPANY_AGENT = "terraeagle-sales-company";
const OUTBOUND_AGENT = "terraeagle-sales-outbound-strategist";
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
					select: { sendDays: true, startMinute: true, endMinute: true },
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
			select: { agentId: true, status: true, input: true },
		});
		const runsByTarget = new Map<string, Map<string, string>>();
		for (const run of existing) {
			const parsed = campaignAgentRunInput.safeParse(run.input);
			if (!parsed.success) throw new Error("A campaign run has invalid input.");
			const targetId = parsed.data.campaignTargetId;
			const agents = runsByTarget.get(targetId) ?? new Map<string, string>();
			if (!agents.has(run.agentId)) agents.set(run.agentId, run.status);
			runsByTarget.set(targetId, agents);
		}
		for (const candidate of targets) {
			if (queued >= DISPATCH.campaign.queuePerTick) break;
			if (!campaignWindowOpen(candidate.campaign, now)) continue;
			const runs = runsByTarget.get(candidate.id);
			const researchStatus = runs?.get(COMPANY_AGENT);
			if (
				!nextCampaignAgent(
					researchStatus,
					runs?.has(OUTBOUND_AGENT) ?? false,
					z.email().safeParse(candidate.contact?.email).success,
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
				if (
					target.company.countryCode?.toUpperCase() !== "IN" &&
					!target.company.country?.toLowerCase().includes("india")
				)
					return false;
				const existing = await tx.agentRun.findMany({
					where: {
						agentId: { in: [COMPANY_AGENT, OUTBOUND_AGENT] },
						input: { path: ["campaignTargetId"], equals: target.id },
					},
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					select: { agentId: true, status: true },
				});
				const research = existing.find((run) => run.agentId === COMPANY_AGENT);
				const draft = existing.find((run) => run.agentId === OUTBOUND_AGENT);
				const agentId = nextCampaignAgent(
					research?.status,
					Boolean(draft),
					z.email().safeParse(target.contact?.email).success,
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
				if (agent?.status !== "LIVE" || !agent.currentVersionId) return false;
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
						idempotencyKey: `campaign:${target.id}:${agentId}`,
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
