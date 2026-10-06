import { ConflictException, Injectable } from "@nestjs/common";
import { SyncStateService } from "../mailbox/sync-state.service";
import type { MicrosoftSyncSource } from "./microsoft.constants";
import { MICROSOFT_SYNC } from "./microsoft-sync-config";
import { OutlookSyncService } from "./outlook-sync.service";

@Injectable()
export class MicrosoftSyncService {
	constructor(
		private readonly state: SyncStateService,
		private readonly outlook: OutlookSyncService,
	) {}

	async runOne(userId: string, source: MicrosoftSyncSource) {
		const row = await this.state.get(userId, source);
		if (!row) return null;

		return this.outlook.sync(row);
	}

	async runForUser(userId: string): Promise<void> {
		const rows = await this.state.listForUser(userId);
		for (const row of rows) {
			if (row.source === "outlook" || row.source.startsWith("outlook:")) {
				await this.outlook.sync(row);
			}
		}
	}

	async backfillRecentMail(userId: string): Promise<void> {
		const from = new Date(
			Date.now() - MICROSOFT_SYNC.backfillDays * MICROSOFT_SYNC.dayMs,
		);
		const row = await this.state.rewindForBackfill(userId, "outlook", from);
		if (!row) {
			throw new ConflictException(
				"Outlook sync is busy or unavailable. Try again later.",
			);
		}
		await this.outlook.sync(row);
	}
}
