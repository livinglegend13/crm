import type { Db } from "@crm/db";
import {
	type ApproveOutreachDraftInput,
	draftFieldsFromRunResult,
	draftResearchFromRunResult,
	type SaveOutreachDraftInput,
} from "@crm/validation/outreach-draft";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { AgentAccessService } from "./agent-access.service";

@Injectable()
export class OutreachDraftsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AgentAccessService,
	) {}

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
				status: edit?.status ?? "DRAFT",
				approvedAt: edit?.approvedAt?.toISOString() ?? null,
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
		const edit = await this.db.outreachDraft.upsert({
			where: { runId_userId: { runId: run.id, userId } },
			create: {
				runId: run.id,
				userId,
				recipientEmail: input.recipientEmail || null,
				subject: input.subject,
				body: input.body,
			},
			update: {
				recipientEmail: input.recipientEmail || null,
				subject: input.subject,
				body: input.body,
				status: "DRAFT",
				approvedAt: null,
			},
		});
		return {
			runId: run.id,
			agentId: run.agent.id,
			agentName: run.agent.name,
			recipientEmail: edit.recipientEmail,
			subject: edit.subject,
			body: edit.body,
			status: edit.status,
			approvedAt: edit.approvedAt?.toISOString() ?? null,
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
		if (/\[[^\]]+\]/.test(`${edit.subject}\n${edit.body}`)) {
			throw new BadRequestException(
				"Replace all bracketed placeholders before approval.",
			);
		}
		if (edit.run.result === null) {
			throw new BadRequestException("This run has no saved email draft.");
		}
		const updated = await this.db.outreachDraft.updateMany({
			where: { id: edit.id, updatedAt: edit.updatedAt },
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
			status: approved.status,
			approvedAt: approved.approvedAt?.toISOString() ?? null,
			researchSummary: edit.run.summary,
			...draftResearchFromRunResult(edit.run.result),
			createdAt: edit.run.createdAt.toISOString(),
			updatedAt: approved.updatedAt.toISOString(),
		};
	}
}
