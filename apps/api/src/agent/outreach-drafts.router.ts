import {
	outreachDraft,
	outreachDraftList,
	type SaveOutreachDraftInput,
	saveOutreachDraftInput,
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
}
