import { type Db, EmailDirection } from "@crm/db";
import { emailMessageRecipients } from "@crm/validation/email-message";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { DELIVERY_FAILURE } from "./delivery-failure.config";
import { failedRecipient } from "./delivery-failure.parse";
import type { IncomingMessage } from "./thread-writer.service";

@Injectable()
export class DeliveryFailureService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async reconcile(mailbox: string, message: IncomingMessage): Promise<boolean> {
		const recipient = failedRecipient(message);
		if (!recipient) return false;
		const from = new Date(
			message.sentAt.getTime() - DELIVERY_FAILURE.matchWindowMs,
		);
		const [messages, cards, drafts] = await Promise.all([
			this.db.emailMessage.findMany({
				where: {
					mailboxAddress: mailbox,
					direction: EmailDirection.OUTBOUND,
					deliveryStatus: "SENT",
					sentAt: { gte: from, lte: message.sentAt },
				},
				orderBy: { sentAt: "desc" },
				take: DELIVERY_FAILURE.candidateLimit,
				select: { id: true, recipients: true },
			}),
			this.db.businessCardCapture.findMany({
				where: {
					senderEmail: mailbox,
					recipientEmail: { equals: recipient, mode: "insensitive" },
					status: "SENT",
					sentAt: { gte: from, lte: message.sentAt },
				},
				orderBy: { sentAt: "desc" },
				take: 2,
				select: { id: true },
			}),
			this.db.outreachDraft.findMany({
				where: {
					senderEmail: mailbox,
					recipientEmail: { equals: recipient, mode: "insensitive" },
					status: "SENT",
					sentAt: { gte: from, lte: message.sentAt },
				},
				orderBy: { sentAt: "desc" },
				take: 2,
				select: { id: true },
			}),
		]);
		const matchingMessages = messages.filter((row) =>
			emailMessageRecipients
				.parse(row.recipients)
				.some((entry) => entry.email.toLowerCase() === recipient),
		);
		const reason = `Delivery failed for ${recipient}. Check the address before sending again.`;
		const sentMessage =
			matchingMessages.length === 1 ? matchingMessages[0] : null;
		const card = cards.length === 1 ? cards[0] : null;
		const draft = drafts.length === 1 ? drafts[0] : null;
		await this.db.$transaction([
			...(sentMessage
				? [
						this.db.emailMessage.update({
							where: { id: sentMessage.id },
							data: { deliveryStatus: "BOUNCED" },
						}),
					]
				: []),
			...(card
				? [
						this.db.businessCardCapture.update({
							where: { id: card.id },
							data: { status: "BOUNCED", sendError: reason },
						}),
					]
				: []),
			...(draft
				? [
						this.db.outreachDraft.update({
							where: { id: draft.id },
							data: { status: "BOUNCED", sendError: reason },
						}),
					]
				: []),
		]);
		return true;
	}
}
