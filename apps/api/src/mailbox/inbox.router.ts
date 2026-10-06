import { Inject } from "@nestjs/common";
import {
	inboxThread,
	inboxThreadInput,
	inboxThreadList,
} from "@crm/validation/inbox";
import { Ctx, Input, Query, Router, UseMiddlewares } from "nestjs-trpc";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { InboxService } from "./inbox.service";

@Router({ alias: "inbox" })
@UseMiddlewares(AuthMiddleware)
export class InboxRouter {
	constructor(@Inject(InboxService) private readonly inbox: InboxService) {}

	@Query({
		output: inboxThreadList,
		meta: restMeta("GET", "/inbox/threads", ["Inbox"]),
	})
	async list(@Ctx() ctx: AuthedTrpcContext) {
		return this.inbox.list(ctx.user.id);
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
