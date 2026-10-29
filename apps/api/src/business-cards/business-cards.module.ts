import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { MailboxModule } from "../mailbox/mailbox.module";
import { MicrosoftModule } from "../microsoft/microsoft.module";
import { TrpcModule } from "../trpc/trpc.module";
import { BusinessCardsRouter } from "./business-cards.router";
import { BusinessCardsService } from "./business-cards.service";

@Module({
	imports: [TrpcModule, MailboxModule, MicrosoftModule, AgentModule],
	providers: [BusinessCardsService, BusinessCardsRouter],
	exports: [BusinessCardsService],
})
export class BusinessCardsModule {}
