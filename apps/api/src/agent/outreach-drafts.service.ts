import {
	MICROSOFT_PROVIDER_ID,
	OUTLOOK_READ_SHARED_SCOPE,
	OUTLOOK_SEND_SHARED_SCOPE,
} from "@crm/auth";
import type { Db } from "@crm/db";
import {
	type ApproveOutreachDraftInput,
	draftFieldsFromRunResult,
	draftResearchFromRunResult,
	type SaveOutreachDraftInput,
	type SendOutreachDraftInput,
} from "@crm/validation/outreach-draft";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";
import { SyncStateService } from "../mailbox/sync-state.service";
import { GraphClient } from "../microsoft/graph.client";
import { MicrosoftConnectionService } from "../microsoft/microsoft-connection.service";
import {
	outreachSenders,
	sharedOutlookSource,
} from "../microsoft/sender-mailboxes";
import { AgentAccessService } from "./agent-access.service";

@Injectable()
export class OutreachDraftsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AgentAccessService,
		private readonly tokens: MailboxTokenService,
		private readonly state: SyncStateService,
		private readonly graph: GraphClient,
		private readonly microsoft: MicrosoftConnectionService,
	) {}

	async senders(userId: string) {
		await this.access.assertMember(userId);
		await this.microsoft.onConnected(userId);
		const addresses = outreachSenders();
		const [scopes, refresh, rows] = await Promise.all([
			this.tokens.grantedScopes(userId, MICROSOFT_PROVIDER_ID),
			this.tokens.hasRefreshToken(userId, MICROSOFT_PROVIDER_ID),
			this.state.listForUser(userId),
		]);
		const bySource = new Map(rows.map((row) => [row.source, row]));
		const connected =
			addresses.length > 0 && scopes.has(OUTLOOK_SEND_SHARED_SCOPE) && refresh;
		const readConnected =
			addresses.length > 0 && scopes.has(OUTLOOK_READ_SHARED_SCOPE) && refresh;
		return {
			addresses,
			connected,
			readConnected,
			mailboxes: addresses.map((address) => {
				const row = bySource.get(sharedOutlookSource(address));
				return {
					address,
					status: row?.status ?? null,
					lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
					lastError: row?.lastError ?? null,
				};
			}),
			reason: connected
				? null
				: addresses.length === 0
					? "No sender mailboxes are configured."
					: "Reconnect Microsoft 365 to grant Mail.Send.Shared.",
		};
	}

	async list(userId: string) {
		await this.access.assertMember(userId);
		const runs = await this.db.agentRun.findMany({
			where: {
				initiatedById: userId,
				status: "SUCCEEDED",
				agent: { status: { not: "DELETED" } },
			},
			orderBy: { createdAt: "desc" },
			take: 100,
			select: {
				id: true,
				result: true,
				summary: true,
				createdAt: true,
				agent: { select: { id: true, name: true } },
			},
		});
		const originals = runs.flatMap((run) => {
			const result = run.result;
			if (result === null) return [];
			const fields = draftFieldsFromRunResult(result);
			return fields ? [{ run, result, fields }] : [];
		});
		const edits = await this.db.outreachDraft.findMany({
			where: { userId, runId: { in: originals.map(({ run }) => run.id) } },
		});
		const editsByRunId = new Map(edits.map((edit) => [edit.runId, edit]));
		return originals.map(({ run, result, fields }) => {
			const edit = editsByRunId.get(run.id);
			return {
				runId: run.id,
				agentId: run.agent.id,
				agentName: run.agent.name,
				recipientEmail: edit?.recipientEmail ?? null,
				subject: edit?.subject ?? fields.subject,
				body: edit?.body ?? fields.body,
				senderEmail: edit?.senderEmail ?? null,
				status: edit?.status ?? "DRAFT",
				approvedAt: edit?.approvedAt?.toISOString() ?? null,
				sendStartedAt: edit?.sendStartedAt?.toISOString() ?? null,
				sentAt: edit?.sentAt?.toISOString() ?? null,
				sendError: edit?.sendError ?? null,
				researchSummary: run.summary,
				...draftResearchFromRunResult(result),
				createdAt: run.createdAt.toISOString(),
				updatedAt: edit?.updatedAt.toISOString() ?? null,
			};
		});
	}

	async save(userId: string, input: SaveOutreachDraftInput) {
		await this.access.assertMember(userId);
		const run = await this.db.agentRun.findFirst({
			where: {
				id: input.runId,
				initiatedById: userId,
				status: "SUCCEEDED",
				agent: { status: { not: "DELETED" } },
			},
			select: {
				id: true,
				result: true,
				summary: true,
				createdAt: true,
				agent: { select: { id: true, name: true } },
			},
		});
		if (!run)
			throw new NotFoundException("No editable outreach run with that id.");
		if (run.result === null || !draftFieldsFromRunResult(run.result)) {
			throw new BadRequestException("This run has no saved email draft.");
		}
		if (
			input.senderEmail &&
			!outreachSenders().includes(input.senderEmail.toLowerCase())
		) {
			throw new BadRequestException("Choose a configured sender mailbox.");
		}
		const existing = await this.db.outreachDraft.findUnique({
			where: { runId_userId: { runId: run.id, userId } },
		});
		if (existing && !["DRAFT", "APPROVED"].includes(existing.status)) {
			throw new ConflictException(
				"This email cannot be edited after sending starts.",
			);
		}
		if (existing) {
			const updated = await this.db.outreachDraft.updateMany({
				where: {
					id: existing.id,
					updatedAt: existing.updatedAt,
					status: { in: ["DRAFT", "APPROVED"] },
				},
				data: {
					recipientEmail: input.recipientEmail || null,
					subject: input.subject,
					body: input.body,
					senderEmail: input.senderEmail?.toLowerCase() ?? null,
					status: "DRAFT",
					approvedAt: null,
					sendError: null,
				},
			});
			if (updated.count !== 1) {
				throw new ConflictException(
					"This draft changed. Reload it before saving.",
				);
			}
		}
		const edit = existing
			? await this.db.outreachDraft.findUniqueOrThrow({
					where: { id: existing.id },
				})
			: await this.db.outreachDraft.create({
					data: {
						runId: run.id,
						userId,
						recipientEmail: input.recipientEmail || null,
						subject: input.subject,
						body: input.body,
						senderEmail: input.senderEmail?.toLowerCase() ?? null,
					},
				});
		return {
			runId: run.id,
			agentId: run.agent.id,
			agentName: run.agent.name,
			recipientEmail: edit.recipientEmail,
			subject: edit.subject,
			body: edit.body,
			senderEmail: edit.senderEmail,
			status: edit.status,
			approvedAt: edit.approvedAt?.toISOString() ?? null,
			sendStartedAt: edit.sendStartedAt?.toISOString() ?? null,
			sentAt: edit.sentAt?.toISOString() ?? null,
			sendError: edit.sendError,
			researchSummary: run.summary,
			...draftResearchFromRunResult(run.result),
			createdAt: run.createdAt.toISOString(),
			updatedAt: edit.updatedAt.toISOString(),
		};
	}

	async approve(userId: string, input: ApproveOutreachDraftInput) {
		await this.access.assertMember(userId);
		const edit = await this.db.outreachDraft.findFirst({
			where: {
				runId: input.runId,
				userId,
				run: {
					initiatedById: userId,
					status: "SUCCEEDED",
					agent: { status: { not: "DELETED" } },
				},
			},
			include: {
				run: {
					select: {
						result: true,
						summary: true,
						createdAt: true,
						agent: { select: { id: true, name: true } },
					},
				},
			},
		});
		if (!edit) throw new NotFoundException("Save this draft before approval.");
		if (edit.status !== "DRAFT") {
			throw new ConflictException("Only an unsent draft can be approved.");
		}
		if (edit.updatedAt.toISOString() !== input.expectedUpdatedAt) {
			throw new BadRequestException(
				"This draft changed. Reload it before approval.",
			);
		}
		if (!z.email().safeParse(edit.recipientEmail).success) {
			throw new BadRequestException(
				"Add a valid recipient email before approval.",
			);
		}
		if (!edit.senderEmail || !outreachSenders().includes(edit.senderEmail)) {
			throw new BadRequestException("Choose a configured sender mailbox.");
		}
		if (/\[[^\]]+\]/.test(`${edit.subject}\n${edit.body}`)) {
			throw new BadRequestException(
				"Replace all bracketed placeholders before approval.",
			);
		}
		if (edit.run.result === null) {
			throw new BadRequestException("This run has no saved email draft.");
		}
		const updated = await this.db.outreachDraft.updateMany({
			where: { id: edit.id, updatedAt: edit.updatedAt, status: "DRAFT" },
			data: { status: "APPROVED", approvedAt: new Date() },
		});
		if (updated.count !== 1) {
			throw new BadRequestException(
				"This draft changed. Reload it before approval.",
			);
		}
		const approved = await this.db.outreachDraft.findUniqueOrThrow({
			where: { id: edit.id },
		});
		return {
			runId: approved.runId,
			agentId: edit.run.agent.id,
			agentName: edit.run.agent.name,
			recipientEmail: approved.recipientEmail,
			subject: approved.subject,
			body: approved.body,
			senderEmail: approved.senderEmail,
			status: approved.status,
			approvedAt: approved.approvedAt?.toISOString() ?? null,
			sendStartedAt: approved.sendStartedAt?.toISOString() ?? null,
			sentAt: approved.sentAt?.toISOString() ?? null,
			sendError: approved.sendError,
			researchSummary: edit.run.summary,
			...draftResearchFromRunResult(edit.run.result),
			createdAt: edit.run.createdAt.toISOString(),
			updatedAt: approved.updatedAt.toISOString(),
		};
	}

	async send(userId: string, input: SendOutreachDraftInput) {
		await this.access.assertMember(userId);
		const draft = await this.db.outreachDraft.findFirst({
			where: { runId: input.runId, userId, status: "APPROVED" },
			include: {
				run: {
					select: {
						initiatedById: true,
						status: true,
						agent: { select: { status: true } },
					},
				},
			},
		});
		if (!draft)
			throw new ConflictException("Approve this draft before sending.");
		if (
			draft.updatedAt.toISOString() !== input.expectedUpdatedAt ||
			draft.run.initiatedById !== userId ||
			draft.run.status !== "SUCCEEDED" ||
			draft.run.agent.status === "DELETED"
		) {
			throw new ConflictException(
				"This draft changed. Reload it before sending.",
			);
		}
		if (
			!draft.senderEmail ||
			!outreachSenders().includes(draft.senderEmail) ||
			!draft.recipientEmail ||
			!z.email().safeParse(draft.recipientEmail).success
		) {
			throw new BadRequestException("Sender or recipient is unavailable.");
		}
		const scopes = await this.tokens.grantedScopes(
			userId,
			MICROSOFT_PROVIDER_ID,
		);
		if (!scopes.has(OUTLOOK_SEND_SHARED_SCOPE)) {
			throw new BadRequestException(
				"Reconnect Microsoft 365 to grant sending access.",
			);
		}
		const token = await this.tokens.accessTokenFor(userId, "outlook");
		if (token.outcome !== "ok") {
			throw new BadRequestException("Reconnect Microsoft 365 before sending.");
		}
		const claimed = await this.db.outreachDraft.updateMany({
			where: {
				id: draft.id,
				status: "APPROVED",
				updatedAt: draft.updatedAt,
			},
			data: { status: "SENDING", sendStartedAt: new Date(), sendError: null },
		});
		if (claimed.count !== 1) {
			throw new ConflictException("Another send started. Reload this draft.");
		}
		const outcome = await this.graph.sendMail(token.accessToken, {
			from: draft.senderEmail,
			to: draft.recipientEmail,
			subject: draft.subject,
			body: draft.body,
		});
		const status =
			outcome === "accepted"
				? "SENT"
				: outcome === "rejected"
					? "APPROVED"
					: "SEND_UNKNOWN";
		const saved = await this.db.outreachDraft.update({
			where: { id: draft.id },
			data: {
				status,
				sentAt: outcome === "accepted" ? new Date() : null,
				sendError:
					outcome === "rejected"
						? "Microsoft rejected this send. Check Send As rights."
						: outcome === "unknown"
							? "Microsoft did not confirm this send. Check Sent Items before retrying."
							: null,
			},
		});
		return {
			status: saved.status,
			sentAt: saved.sentAt?.toISOString() ?? null,
			error: saved.sendError,
		};
	}
}
