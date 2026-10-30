import {
	businessCardExtraction,
	businessCardMatchCandidate,
	businessCardMessageInput,
	businessCardSendInput,
	confirmBusinessCardInput,
} from "@crm/validation/business-card";
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
import { BusinessCardsService } from "./business-cards.service";

const captureRow = z.object({
	id: z.string(),
	extraction: businessCardExtraction,
	matchCandidates: z.array(businessCardMatchCandidate),
	meetingNote: z.string().nullable(),
	recentlyMet: z.boolean(),
	autoSend: z.boolean(),
	status: z.string(),
	contactId: z.string().nullable(),
	campaignId: z.string().nullable(),
	sendError: z.string().nullable(),
	subject: z.string(),
	body: z.string(),
	senderEmail: z.string(),
	createdAt: z.string(),
	sentAt: z.string().nullable(),
});

@Router({ alias: "businessCards" })
@UseMiddlewares(AuthMiddleware)
export class BusinessCardsRouter {
	constructor(private readonly cards: BusinessCardsService) {}

	@Query({ output: z.array(captureRow) })
	list(@Ctx() ctx: AuthedTrpcContext) {
		return this.cards.list(ctx.user.id);
	}

	@Mutation({
		input: confirmBusinessCardInput,
		output: z.object({
			id: z.string(),
			status: z.string(),
			contactId: z.string().nullable(),
			campaignId: z.string().nullable(),
		}),
	})
	confirm(
		@Input() input: z.infer<typeof confirmBusinessCardInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.cards.confirm(ctx.user.id, input);
	}

	@Mutation({
		input: businessCardMessageInput,
		output: z.object({ id: z.string() }),
	})
	editMessage(
		@Input() input: z.infer<typeof businessCardMessageInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.cards.editMessage(ctx.user.id, input);
	}

	@Mutation({
		input: businessCardSendInput,
		output: z.object({ status: z.string() }),
	})
	requestSend(
		@Input() input: z.infer<typeof businessCardSendInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.cards.requestSend(ctx.user.id, input);
	}

	@Mutation({
		input: businessCardSendInput,
		output: z.object({ status: z.string() }),
	})
	retryUnknown(
		@Input() input: z.infer<typeof businessCardSendInput>,
		@Ctx() ctx: AuthedTrpcContext,
	) {
		return this.cards.retryUnknown(ctx.user.id, input);
	}
}
