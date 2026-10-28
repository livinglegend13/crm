import {
	inboxFollowUpAction,
	inboxFollowUpActionResult,
	inboxFollowUpList,
	inboxThread,
	inboxThreadFeedbackInput,
	inboxThreadFeedbackResult,
	inboxThreadInput,
	inboxThreadList,
	inboxThreadListInput,
} from "@crm/validation/inbox";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { InboxService } from "./inbox.service";

@Router({ alias: "inbox" })
@UseMiddlewares(AuthMiddleware)
export class InboxRouter {
	constructor(@Inject(InboxService) private readonly inbox: InboxService) {}

	@Query({ output: inboxFollowUpList })
	async followUps(@Ctx() ctx: AuthedTrpcContext) {
		return this.inbox.followUps(ctx.user.id);
	}

	@Mutation({
		input: inboxFollowUpAction,
		output: inboxFollowUpActionResult,
	})
	async followUpAction(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inboxFollowUpAction>,
	) {
		return this.inbox.followUpAction(ctx.user.id, input);
	}

	@Query({
		input: inboxThreadListInput,
		output: inboxThreadList,
		meta: restMeta("GET", "/inbox/threads", ["Inbox"]),
	})
	async list(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inboxThreadListInput>,
	) {
		return this.inbox.list(ctx.user.id, input);
	}

	@Mutation({
		input: inboxThreadFeedbackInput,
		output: inboxThreadFeedbackResult,
	})
	async feedback(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof inboxThreadFeedbackInput>,
	) {
		return this.inbox.feedback(ctx.user.id, input);
	}

	@Query({
		input: inboxThreadInput,
		output: inboxThread,
		meta: restMeta("GET", "/inbox/threads/{id}", ["Inbox"]),
	})
	async thread(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.inbox.thread(ctx.user.id, id);
	}
}
