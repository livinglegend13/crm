import {
	type AddCampaignTargetInput,
	addCampaignTargetInput,
	type CreateCampaignInput,
	campaignDetail,
	campaignIdInput,
	campaignsOutput,
	createCampaignInput,
	filoReview,
	gtmInsights,
	type ProspectsInput,
	prospectsInput,
	prospectsOutput,
	type RemoveCampaignTargetInput,
	removeCampaignTargetInput,
	type SaveCampaignStepsInput,
	type SaveFiloReviewInput,
	saveCampaignStepsInput,
	saveFiloReviewInput,
	type UpdateCampaignInput,
	updateCampaignInput,
} from "@crm/validation/gtm";
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
import { GtmService } from "./gtm.service";

@Router({ alias: "gtm" })
@UseMiddlewares(AuthMiddleware)
export class GtmRouter {
	constructor(@Inject(GtmService) private readonly gtm: GtmService) {}

	@Query({
		input: prospectsInput,
		output: prospectsOutput,
		meta: restMeta("POST", "/gtm/prospects/search", ["GTM"]),
	})
	prospects(@Ctx() ctx: AuthedTrpcContext, @Input() input: ProspectsInput) {
		return this.gtm.prospects(ctx.user.id, input);
	}

	@Mutation({
		input: saveFiloReviewInput,
		output: filoReview,
		meta: restMeta("PUT", "/gtm/prospects/{companyId}/review", ["GTM"]),
	})
	saveReview(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: SaveFiloReviewInput,
	) {
		return this.gtm.saveReview(ctx.user.id, input);
	}

	@Query({
		output: campaignsOutput,
		meta: restMeta("GET", "/gtm/campaigns", ["GTM"]),
	})
	campaigns(@Ctx() ctx: AuthedTrpcContext) {
		return this.gtm.campaigns(ctx.user.id);
	}

	@Query({
		input: campaignIdInput,
		output: campaignDetail,
		meta: restMeta("GET", "/gtm/campaigns/{id}", ["GTM"]),
	})
	campaign(@Ctx() ctx: AuthedTrpcContext, @Input("id") id: string) {
		return this.gtm.campaign(ctx.user.id, id);
	}

	@Mutation({
		input: createCampaignInput,
		output: campaignDetail,
		meta: restMeta("POST", "/gtm/campaigns", ["GTM"]),
	})
	createCampaign(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: CreateCampaignInput,
	) {
		return this.gtm.createCampaign(ctx.user.id, input);
	}

	@Mutation({
		input: updateCampaignInput,
		output: campaignDetail,
		meta: restMeta("PUT", "/gtm/campaigns/{id}", ["GTM"]),
	})
	updateCampaign(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: UpdateCampaignInput,
	) {
		return this.gtm.updateCampaign(ctx.user.id, input);
	}

	@Mutation({
		input: saveCampaignStepsInput,
		output: campaignDetail,
		meta: restMeta("PUT", "/gtm/campaigns/{id}/steps", ["GTM"]),
	})
	saveSteps(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: SaveCampaignStepsInput,
	) {
		return this.gtm.saveSteps(ctx.user.id, input);
	}

	@Mutation({
		input: addCampaignTargetInput,
		output: campaignDetail,
		meta: restMeta("POST", "/gtm/campaigns/{id}/targets", ["GTM"]),
	})
	addTarget(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: AddCampaignTargetInput,
	) {
		return this.gtm.addTarget(ctx.user.id, input);
	}

	@Mutation({
		input: removeCampaignTargetInput,
		output: campaignDetail,
		meta: restMeta("DELETE", "/gtm/campaigns/{id}/targets/{targetId}", ["GTM"]),
	})
	removeTarget(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: RemoveCampaignTargetInput,
	) {
		return this.gtm.removeTarget(ctx.user.id, input);
	}

	@Query({
		output: gtmInsights,
		meta: restMeta("GET", "/gtm/insights", ["GTM"]),
	})
	insights(@Ctx() ctx: AuthedTrpcContext) {
		return this.gtm.insights(ctx.user.id);
	}
}
