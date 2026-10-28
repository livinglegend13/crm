import { randomUUID } from "node:crypto";
import { db } from "@crm/db";
import { parseAgentManifest } from "@crm/validation/agent-manifest";
import { chatAgentRunInput } from "@crm/validation/chat-agent-run";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { purposeOf, requireAttribute } from "../lib/session-purpose";

const submissionMessage = z.object({
	text: z.string(),
	resources: z.array(
		z.object({
			kind: z.enum(["integration", "company", "contact", "deal", "agent"]),
			id: z.string(),
			label: z.string(),
		}),
	),
});

export default defineTool({
	description:
		"Run one tagged live team agent for one tagged CRM record in read-only chat mode. The runner blocks CRM writes and external messages. Return the linked run ID. Only use when the user explicitly asks to run an agent.",
	inputSchema: z.object({
		agentId: z.string().min(1),
		recordKind: z.enum(["company", "contact", "deal"]),
		recordId: z.string().min(1),
		focus: z.string().trim().min(1).max(2000),
	}),
	async execute(input, ctx) {
		if (purposeOf(ctx) !== "builder") {
			throw new Error("A private CRM chat is required.");
		}
		const conversationId = requireAttribute(ctx, "conversationId");
		const submissionId = requireAttribute(ctx, "submissionId");
		const userId = requireAttribute(ctx, "userId");
		const submission = await db.agentConversationSubmission.findFirst({
			where: {
				id: submissionId,
				conversationId,
				conversation: { userId, kind: "BUILDER" },
			},
			select: { message: true },
		});
		if (!submission) throw new Error("This private chat is unavailable.");
		const message = submissionMessage.parse(submission.message);
		if (
			message.resources.filter((resource) => resource.kind === "agent").length !== 1 ||
			message.resources.filter(
				(resource) =>
					resource.kind === "company" ||
					resource.kind === "contact" ||
					resource.kind === "deal",
			).length !== 1
		) {
			throw new Error("Tag exactly one team agent and one CRM record.");
		}
		const selectedAgent = message.resources.find(
			(resource) => resource.kind === "agent" && resource.id === input.agentId,
		);
		const selectedRecord = message.resources.find(
			(resource) =>
				resource.kind === input.recordKind && resource.id === input.recordId,
		);
		if (!selectedAgent || !selectedRecord) {
			throw new Error("Tag one live agent and one CRM record in this message.");
		}
		const agent = await db.agentDefinition.findFirst({
			where: { id: input.agentId, status: "LIVE" },
			select: {
				id: true,
				name: true,
				currentVersion: { select: { id: true, manifest: true } },
			},
		});
		if (!agent?.currentVersion) throw new Error("This agent is not live.");
		const record =
			input.recordKind === "company"
				? await db.company.findFirst({
						where: { id: input.recordId, archivedAt: null },
						select: { id: true, name: true },
					})
				: input.recordKind === "contact"
					? await db.contact.findFirst({
							where: { id: input.recordId, archivedAt: null },
							select: { id: true, firstName: true, lastName: true },
						})
					: await db.deal.findFirst({
							where: { id: input.recordId, archivedAt: null },
							select: { id: true, name: true },
						});
		if (!record) throw new Error("This CRM record is unavailable.");
		const manifest = parseAgentManifest(agent.currentVersion.manifest);
		if (
			manifest.dataScope.mode === "SELECTED" &&
			!manifest.dataScope.resources.some(
				(resource) =>
					resource.kind === input.recordKind && resource.id === input.recordId,
			)
		) {
			throw new Error("This record is outside the agent's selected scope.");
		}
		const idempotencyKey = `chat:${submissionId}:${agent.id}`;
		const runInput = chatAgentRunInput.parse({
			mode: "CHAT_READ_ONLY",
			focus: input.focus,
			conversationId,
			submissionId,
			record: {
				kind: input.recordKind,
				id: record.id,
				label:
					"firstName" in record
						? [record.firstName, record.lastName].filter(Boolean).join(" ")
						: record.name,
			},
		});
		const run = await db.agentRun.upsert({
			where: { idempotencyKey },
			create: {
				agentId: agent.id,
				versionId: agent.currentVersion.id,
				initiatedById: userId,
				triggerType: "MANUAL",
				input: runInput,
				idempotencyKey,
				correlationId: randomUUID(),
				events: {
					create: { sequence: 0, type: "run.queued", data: {} },
				},
			},
			update: {},
			select: { id: true, status: true },
		});
		return {
			runId: run.id,
			status: run.status,
			agentId: agent.id,
			agentName: agent.name,
			recordKind: input.recordKind,
			recordId: record.id,
			recordLabel: runInput.record.label,
		};
	},
});
