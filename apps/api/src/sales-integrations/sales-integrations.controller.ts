import { Body, Controller, Headers, HttpCode, Post } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { SalesIntegrationsService } from "./sales-integrations.service";

@Controller("api/integrations/closely")
export class SalesIntegrationsController {
	constructor(private readonly integrations: SalesIntegrationsService) {}

	@Post("events")
	@AllowAnonymous()
	@HttpCode(202)
	async receive(
		@Headers("x-terraeagle-webhook-key") key: string | undefined,
		@Body() body: unknown,
	) {
		return this.integrations.receiveClosely(key, body);
	}
}
