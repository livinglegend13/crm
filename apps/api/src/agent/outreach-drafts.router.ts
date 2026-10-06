import {
	type ApproveOutreachDraftInput,
	approveOutreachDraftInput,
	outreachDraft,
	outreachDraftList,
	outreachSendersOutput,
	outreachStats,
	type RegenerateOutreachDraftInput,
	regenerateOutreachDraftInput,
	regenerateOutreachDraftOutput,
	type SaveOutreachDraftInput,
	type SendOutreachDraftInput,
	saveOutreachDraftInput,
	sendOutreachDraftInput,
	sendOutreachDraftOutput,
} from "@crm/validation/outreach-draft";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { OutreachDraftsService } from "./outreach-drafts.service";

@Router({ alias: "outreachDrafts" })
@UseMiddlewares(AuthMiddleware)
export class OutreachDraftsRouter {
	constructor(
		@Inject(OutreachDraftsService)
		private readonly drafts: OutreachDraftsService,
	) {}

	@Query({
		output: outreachDraftList,
		meta: restMeta("GET", "/outreach-drafts", ["Outreach"]),
	})
	async list(@Ctx() ctx: AuthedTrpcContext) {
		return this.drafts.list(ctx.user.id);
	}

	@Query({
		output: outreachStats,
		meta: restMeta("GET", "/outreach-stats", ["Outreach"]),
	})
	async stats(@Ctx() ctx: AuthedTrpcContext) {
		return this.drafts.stats(ctx.user.id);
	}

	@Query({
		output: outreachSendersOutput,
		meta: restMeta("GET", "/outreach-senders", ["Outreach"]),
	})
	async senders(@Ctx() ctx: AuthedTrpcContext) {
		return this.drafts.senders(ctx.user.id);
	}

	@Mutation({
		input: saveOutreachDraftInput,
		output: outreachDraft,
		meta: restMeta("POST", "/outreach-drafts/{runId}", ["Outreach"]),
	})
	async save(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: SaveOutreachDraftInput,
	) {
		return this.drafts.save(ctx.user.id, input);
	}

	@Mutation({
		input: approveOutreachDraftInput,
		output: outreachDraft,
		meta: restMeta("POST", "/outreach-drafts/{runId}/approve", ["Outreach"]),
	})
	async approve(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: ApproveOutreachDraftInput,
	) {
		return this.drafts.approve(ctx.user.id, input);
	}

	@Mutation({
		input: sendOutreachDraftInput,
		output: sendOutreachDraftOutput,
		meta: restMeta("POST", "/outreach-drafts/{runId}/send", ["Outreach"]),
	})
	async send(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: SendOutreachDraftInput,
	) {
		return this.drafts.send(ctx.user.id, input);
	}

	@Mutation({
		input: regenerateOutreachDraftInput,
		output: regenerateOutreachDraftOutput,
		meta: restMeta("POST", "/outreach-drafts/{runId}/regenerate", ["Outreach"]),
	})
	async regenerate(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: RegenerateOutreachDraftInput,
	) {
		return this.drafts.regenerate(ctx.user.id, input);
	}
}
