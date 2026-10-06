import { MICROSOFT_PROVIDER_ID, OUTLOOK_SEND_SHARED_SCOPE } from "@crm/auth";
import type { Db } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";
import type { IncomingMessage } from "../mailbox/thread-writer.service";
import { GraphClient } from "./graph.client";

function baseSubject(value: string | null): string {
	return (value ?? "")
		.replace(/^(?:(?:re|fw|fwd):\s*)+/gi, "")
		.trim()
		.toLowerCase();
}

@Injectable()
export class OutreachRepliesService {
	private readonly logger = new Logger(OutreachRepliesService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly graph: GraphClient,
		private readonly tokens: MailboxTokenService,
	) {}

	async match(mailbox: string, message: IncomingMessage) {
		if (message.from.email === mailbox) return null;
		const candidates = await this.db.outreachDraft.findMany({
			where: {
				senderEmail: mailbox,
				recipientEmail: { equals: message.from.email, mode: "insensitive" },
				status: "SENT",
				sentAt: { lte: message.sentAt },
			},
			orderBy: { sentAt: "desc" },
			take: 50,
			select: {
				id: true,
				userId: true,
				subject: true,
				user: { select: { email: true } },
			},
		});
		const subject = baseSubject(message.subject);
		if (!subject) return null;
		return (
			candidates.find((draft) => baseSubject(draft.subject) === subject) ?? null
		);
	}

	async record(
		mailbox: string,
		message: IncomingMessage,
		draft: NonNullable<Awaited<ReturnType<OutreachRepliesService["match"]>>>,
	) {
		if (!draft.user.email) return;
		await this.db.outreachReplyAlert.upsert({
			where: { messageId: message.rfcMessageId },
			create: {
				messageId: message.rfcMessageId,
				draftId: draft.id,
				userId: draft.userId,
				senderEmail: mailbox,
				toEmail: draft.user.email,
				fromEmail: message.from.email,
				subject: message.subject ?? draft.subject,
			},
			update: {},
		});
	}

	async deliverPending(userId: string, mailbox: string, accessToken: string) {
		if (process.env.OUTREACH_REPLY_ALERTS_ENABLED !== "true") return;
		const scopes = await this.tokens.grantedScopes(
			userId,
			MICROSOFT_PROVIDER_ID,
		);
		if (!scopes.has(OUTLOOK_SEND_SHARED_SCOPE)) return;
		const pending = await this.db.outreachReplyAlert.findMany({
			where: { userId, senderEmail: mailbox, status: "PENDING" },
			orderBy: { createdAt: "asc" },
			take: 20,
		});
		for (const alert of pending) {
			const claimed = await this.db.outreachReplyAlert.updateMany({
				where: { messageId: alert.messageId, status: "PENDING" },
				data: { status: "SENDING", startedAt: new Date(), error: null },
			});
			if (claimed.count !== 1) continue;
			const appUrl = process.env.APP_URL?.split(",")[0]?.trim();
			const inboxUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/inbox` : "";
			const outcome = await this.graph.sendMail(accessToken, {
				from: mailbox,
				to: alert.toEmail,
				subject: `CRM reply: ${alert.subject}`,
				body: `A reply from ${alert.fromEmail} arrived at ${mailbox}.\n\nSubject: ${alert.subject}${inboxUrl ? `\n\nOpen CRM inbox: ${inboxUrl}` : ""}`,
			});
			await this.db.outreachReplyAlert.update({
				where: { messageId: alert.messageId },
				data: {
					status:
						outcome === "accepted"
							? "SENT"
							: outcome === "rejected"
								? "PENDING"
								: "UNKNOWN",
					sentAt: outcome === "accepted" ? new Date() : null,
					error:
						outcome === "accepted"
							? null
							: `Microsoft ${outcome} the reply alert.`,
				},
			});
			if (outcome !== "accepted") {
				this.logger.warn({
					message: "Reply alert was not accepted",
					userId,
					mailbox,
					outcome,
				});
			}
		}
	}
}
