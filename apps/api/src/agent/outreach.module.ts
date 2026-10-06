import { Module } from "@nestjs/common";
import { MailboxModule } from "../mailbox/mailbox.module";
import { MicrosoftModule } from "../microsoft/microsoft.module";
import { TrpcModule } from "../trpc/trpc.module";
import { AgentAccessService } from "./agent-access.service";
import { OutreachDraftsRouter } from "./outreach-drafts.router";
import { OutreachDraftsService } from "./outreach-drafts.service";

@Module({
	imports: [TrpcModule, MailboxModule, MicrosoftModule],
	providers: [AgentAccessService, OutreachDraftsRouter, OutreachDraftsService],
})
export class OutreachModule {}
