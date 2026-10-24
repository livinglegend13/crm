import {
	closelyConnectionStatus,
	closelyEventList,
} from "@crm/validation/closely";
import {
	emailVerificationList,
	emailVerificationRow,
} from "@crm/validation/reoon";
import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { SalesIntegrationsService } from "./sales-integrations.service";

const contactInput = z.object({ contactId: z.string().min(1) });

@Router({ alias: "salesIntegrations" })
@UseMiddlewares(AuthMiddleware)
export class SalesIntegrationsRouter {
	constructor(
		@Inject(SalesIntegrationsService)
		private readonly integrations: SalesIntegrationsService,
	) {}

	@Query({ output: closelyEventList })
	async closelyEvents(@Ctx() ctx: AuthedTrpcContext) {
		return this.integrations.closelyEvents(ctx.user.id);
	}

	@Query({ output: closelyConnectionStatus })
	async status(@Ctx() ctx: AuthedTrpcContext) {
		return this.integrations.status(ctx.user.id);
	}

	@Mutation({
		input: z.object({ enabled: z.boolean() }),
		output: closelyConnectionStatus,
	})
	async setEmailHandoff(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: { enabled: boolean },
	) {
		return this.integrations.setEmailHandoff(ctx.user.id, input.enabled);
	}

	@Query({ input: contactInput, output: emailVerificationRow.nullable() })
	async emailVerification(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactInput>,
	) {
		return this.integrations.emailVerification(ctx.user.id, input.contactId);
	}

	@Mutation({ input: contactInput, output: z.object({ queued: z.boolean() }) })
	async verifyEmail(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof contactInput>,
	) {
		return this.integrations.verifyEmail(ctx.user.id, input.contactId);
	}

	@Mutation({
		input: z.object({ email: z.email() }),
		output: z.object({ queued: z.boolean() }),
	})
	async verifyEmailByAddress(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: { email: string },
	) {
		return this.integrations.verifyEmailByAddress(ctx.user.id, input.email);
	}

	@Query({ output: emailVerificationList })
	async emailVerifications(@Ctx() ctx: AuthedTrpcContext) {
		return this.integrations.emailVerifications(ctx.user.id);
	}
}
