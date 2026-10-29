import { Module } from "@nestjs/common";
import { BusinessCardsModule } from "../business-cards/business-cards.module";
import { GoogleModule } from "../google/google.module";
import { MailboxModule } from "../mailbox/mailbox.module";
import { MicrosoftModule } from "../microsoft/microsoft.module";
import { MailboxSyncService } from "./mailbox-sync.service";
import { SyncController } from "./sync.controller";

@Module({
	imports: [MailboxModule, GoogleModule, MicrosoftModule, BusinessCardsModule],
	controllers: [SyncController],
	providers: [MailboxSyncService],
	exports: [MailboxSyncService],
})
export class SyncModule {}
