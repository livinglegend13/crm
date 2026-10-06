import type { Db } from "@crm/db";
import {
	draftFieldsFromRunResult,
	type SaveOutreachDraftInput,
} from "@crm/validation/outreach-draft";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
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
				agent: {
					status: { not: "DELETED" },
					OR: [
						{ name: { contains: "outreach", mode: "insensitive" } },
						{ name: { contains: "email", mode: "insensitive" } },
					],
				},
			},
			orderBy: { createdAt: "desc" },
			take: 100,
			select: {
				id: true,
				result: true,
				createdAt: true,
				agent: { select: { id: true, name: true } },
			},
		});
		const originals = runs.flatMap((run) => {
			if (run.result === null) return [];
			const fields = draftFieldsFromRunResult(run.result);
			return fields ? [{ run, fields }] : [];
		});
		const edits = await this.db.outreachDraft.findMany({
			where: { userId, runId: { in: originals.map(({ run }) => run.id) } },
		});
		const editsByRunId = new Map(edits.map((edit) => [edit.runId, edit]));
		return originals.map(({ run, fields }) => {
			const edit = editsByRunId.get(run.id);
			return {
				runId: run.id,
				agentId: run.agent.id,
				agentName: run.agent.name,
				recipientEmail: edit?.recipientEmail ?? null,
				subject: edit?.subject ?? fields.subject,
				body: edit?.body ?? fields.body,
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
				agent: {
					status: { not: "DELETED" },
					OR: [
						{ name: { contains: "outreach", mode: "insensitive" } },
						{ name: { contains: "email", mode: "insensitive" } },
					],
				},
			},
			select: {
				id: true,
				result: true,
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
			},
		});
		return {
			runId: run.id,
			agentId: run.agent.id,
			agentName: run.agent.name,
			recipientEmail: edit.recipientEmail,
			subject: edit.subject,
			body: edit.body,
			createdAt: run.createdAt.toISOString(),
			updatedAt: edit.updatedAt.toISOString(),
		};
	}
}
