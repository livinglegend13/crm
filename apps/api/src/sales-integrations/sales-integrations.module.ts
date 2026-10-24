import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { TrpcModule } from "../trpc/trpc.module";
import { SalesIntegrationsController } from "./sales-integrations.controller";
import { SalesIntegrationsRouter } from "./sales-integrations.router";
import { SalesIntegrationsService } from "./sales-integrations.service";

@Module({
	imports: [AgentModule, TrpcModule],
	controllers: [SalesIntegrationsController],
	providers: [SalesIntegrationsService, SalesIntegrationsRouter],
})
export class SalesIntegrationsModule {}
