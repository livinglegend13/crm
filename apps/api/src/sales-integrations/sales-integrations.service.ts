import { createHash, timingSafeEqual } from "node:crypto";
import { canManageConnections } from "@crm/auth";
import { type Db } from "@crm/db";
import { SETTINGS_ID } from "@crm/db/settings";
import { readAzureSecret } from "@crm/env/azure-vault";
import { closelyWebhook } from "@crm/validation/closely";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { AgentAccessService } from "../agent/agent-access.service";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { InjectDatabase } from "../database/database.constants";
import { SALES_INTEGRATIONS } from "./sales-integrations.config";

@Injectable()
export class SalesIntegrationsService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly access: AgentAccessService,
		private readonly trigger: AgentTriggerService,
	) {}

	async receiveClosely(key: string | undefined, body: unknown) {
		const expected =
			process.env.CLOSELY_WEBHOOK_SECRET?.trim() ??
			(await this.closelySecret());
		if (!expected)
			throw new ServiceUnavailableException(
				"Closely intake is not configured.",
			);
		const provided = key ?? "";
		const left = createHash("sha256").update(provided).digest();
		const right = createHash("sha256").update(expected).digest();
		if (!timingSafeEqual(left, right))
			throw new ForbiddenException("Invalid webhook key.");
		if (
			JSON.stringify(body ?? null).length >
			SALES_INTEGRATIONS.closely.maxBodyBytes
		)
			throw new BadRequestException("Closely event is too large.");
		const parsed = closelyWebhook.safeParse(body);
		if (!parsed.success)
			throw new BadRequestException("Invalid Closely event.");
		const input = parsed.data;
		const fingerprint = createHash("sha256")
			.update(JSON.stringify(input))
			.digest("hex");
		const event = await this.db.closelyEvent.upsert({
			where: { fingerprint },
			update: {},
			create: {
				fingerprint,
				trigger: input.trigger,
				email: (input.workEmail ?? input.directEmail)?.toLowerCase() ?? null,
				linkedinUrl: input.linkedinUrl ?? null,
				firstName: input.firstName ?? null,
				lastName: input.lastName ?? null,
				companyName: input.companyDto?.name ?? input.company ?? null,
				campaignNames: input.accountDto?.campaignsName ?? [],
				accountEmail: input.accountDto?.email?.toLowerCase() ?? null,
				accountName:
					[input.accountDto?.firstName, input.accountDto?.lastName]
						.filter(Boolean)
						.join(" ") || null,
			},
		});
		await this.trigger.closelyEventReceived(event.id);
		return { received: true };
	}

	async closelyEvents(userId: string) {
		await this.access.assertMember(userId);
		const rows = await this.db.closelyEvent.findMany({
			take: SALES_INTEGRATIONS.closely.feedLimit,
			orderBy: { receivedAt: "desc" },
		});
		return rows.map((row) => ({
			id: row.id,
			trigger: row.trigger,
			email: row.email,
			linkedinUrl: row.linkedinUrl,
			firstName: row.firstName,
			lastName: row.lastName,
			companyName: row.companyName,
			campaignNames: row.campaignNames,
			accountEmail: row.accountEmail,
			accountName: row.accountName,
			contactId: row.contactId,
			receivedAt: row.receivedAt.toISOString(),
		}));
	}

	async status(userId: string) {
		const role = await this.access.assertMember(userId);
		const [lastEvent, setting] = await Promise.all([
			this.db.closelyEvent.findFirst({
				orderBy: { receivedAt: "desc" },
				select: { receivedAt: true },
			}),
			this.db.appSetting.findUnique({
				where: { id: SETTINGS_ID },
				select: { closelyEmailEnabled: true },
			}),
		]);
		return {
			configured: Boolean(
				process.env.CLOSELY_WEBHOOK_SECRET?.trim() ||
					process.env.CLOSELY_KEY_VAULT_NAME?.trim(),
			),
			receiving: Boolean(lastEvent),
			lastEventAt: lastEvent?.receivedAt.toISOString() ?? null,
			emailHandoffEnabled: setting?.closelyEmailEnabled ?? false,
			canManage: canManageConnections(role),
		};
	}

	private async closelySecret(): Promise<string | null> {
		const vault = process.env.CLOSELY_KEY_VAULT_NAME?.trim();
		return vault ? readAzureSecret(vault, "closely-webhook-key") : null;
	}

	async setEmailHandoff(userId: string, enabled: boolean) {
		const role = await this.access.assertMember(userId);
		if (!canManageConnections(role))
			throw new ForbiddenException(
				"Only an owner or admin can change this connection.",
			);
		await this.db.appSetting.upsert({
			where: { id: SETTINGS_ID },
			create: { id: SETTINGS_ID, closelyEmailEnabled: enabled },
			update: { closelyEmailEnabled: enabled },
		});
		return this.status(userId);
	}

	async emailVerification(userId: string, contactId: string) {
		await this.access.assertMember(userId);
		const row = await this.db.emailVerification.findUnique({
			where: { contactId },
		});
		return row ? { ...row, checkedAt: row.checkedAt.toISOString() } : null;
	}

	async verifyEmail(userId: string, contactId: string) {
		await this.access.assertMember(userId);
		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { email: true },
		});
		if (!contact) throw new NotFoundException("Contact not found.");
		if (!contact.email || !z.email().safeParse(contact.email).success)
			throw new BadRequestException("Contact has no valid email address.");
		await this.trigger.emailVerificationRequested(contactId);
		return { queued: true };
	}

	async verifyEmailByAddress(userId: string, email: string) {
		await this.access.assertMember(userId);
		const contact = await this.db.contact.findFirst({
			where: {
				email: { equals: email, mode: "insensitive" },
				archivedAt: null,
			},
			select: { id: true },
		});
		if (!contact)
			throw new NotFoundException("No CRM contact has this email address.");
		return this.verifyEmail(userId, contact.id);
	}

	async emailVerifications(userId: string) {
		await this.access.assertMember(userId);
		const rows = await this.db.emailVerification.findMany({
			take: 100,
			orderBy: { checkedAt: "desc" },
		});
		return rows.map((row) => ({
			...row,
			checkedAt: row.checkedAt.toISOString(),
		}));
	}
}
