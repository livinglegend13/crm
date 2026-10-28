import type { Db } from "@crm/db";
import type { inboxFollowUpAction } from "@crm/validation/inbox";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";

type StoredMessage = {
	id: string;
	direction: "INBOUND" | "OUTBOUND";
	fromEmail: string;
	fromName: string | null;
	snippet: string | null;
	body: string | null;
	sentAt: Date;
	gmailMessageId: string | null;
	outlookWebLink: string | null;
};

function messageOf(message: StoredMessage) {
	return {
		id: message.id,
		direction: message.direction,
		fromEmail: message.fromEmail,
		fromName: message.fromName,
		snippet: message.snippet,
		body: message.body,
		sentAt: message.sentAt.toISOString(),
		mailboxUrl:
			message.outlookWebLink ??
			(message.gmailMessageId
				? `https://mail.google.com/mail/u/0/#all/${message.gmailMessageId}`
				: null),
	};
}

@Injectable()
export class InboxService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async followUps(userId: string) {
		const rows = await this.db.emailFollowUp.findMany({
			where: { userId },
			orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
			take: 100,
			select: {
				id: true,
				threadId: true,
				owner: true,
				reason: true,
				evidenceQuote: true,
				dueAt: true,
				dueSource: true,
				confidence: true,
				snoozedUntil: true,
				dismissedAt: true,
				thread: {
					select: {
						subject: true,
						lastMessageAt: true,
						company: { select: { id: true, name: true } },
						contact: {
							select: { id: true, firstName: true, lastName: true },
						},
						messages: {
							where: { syncedByUserId: userId },
							orderBy: { sentAt: "desc" },
							take: 1,
							select: {
								id: true,
								direction: true,
								fromEmail: true,
								fromName: true,
								snippet: true,
								body: true,
								sentAt: true,
								gmailMessageId: true,
								outlookWebLink: true,
							},
						},
					},
				},
			},
		});
		return rows.map((row) => ({
			id: row.id,
			threadId: row.threadId,
			subject: row.thread.subject,
			company: row.thread.company,
			contact: row.thread.contact
				? {
						id: row.thread.contact.id,
						name: [row.thread.contact.firstName, row.thread.contact.lastName]
							.filter(Boolean)
							.join(" "),
					}
				: null,
			owner: row.owner,
			reason: row.reason,
			evidenceQuote: row.evidenceQuote,
			dueAt: row.dueAt?.toISOString() ?? null,
			dueSource: row.dueSource,
			confidence: row.confidence,
			snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
			dismissedAt: row.dismissedAt?.toISOString() ?? null,
			lastMessageAt: row.thread.lastMessageAt.toISOString(),
			lastMessage: row.thread.messages[0]
				? messageOf(row.thread.messages[0])
				: null,
		}));
	}

	async followUpAction(
		userId: string,
		input: z.infer<typeof inboxFollowUpAction>,
	) {
		const until = input.until ? new Date(input.until) : null;
		if (
			input.action === "SNOOZE" &&
			(!until || Number.isNaN(until.getTime()) || until <= new Date())
		)
			throw new BadRequestException("Choose a future reminder time.");
		const outcome = await this.db.emailFollowUp.updateMany({
			where: { userId, threadId: input.threadId },
			data:
				input.action === "DISMISS"
					? { dismissedAt: new Date(), snoozedUntil: null }
					: input.action === "SNOOZE"
						? { snoozedUntil: until, dismissedAt: null }
						: { dismissedAt: null, snoozedUntil: null },
		});
		return { updated: outcome.count === 1 };
	}

	async list(userId: string) {
		const threads = await this.db.emailThread.findMany({
			where: { messages: { some: { syncedByUserId: userId } } },
			orderBy: { lastMessageAt: "desc" },
			take: 50,
			select: {
				id: true,
				subject: true,
				lastMessageAt: true,
				company: { select: { id: true, name: true } },
				contact: {
					select: { id: true, firstName: true, lastName: true },
				},
				messages: {
					where: { syncedByUserId: userId },
					orderBy: { sentAt: "desc" },
					take: 1,
					select: {
						id: true,
						direction: true,
						fromEmail: true,
						fromName: true,
						snippet: true,
						body: true,
						sentAt: true,
						gmailMessageId: true,
						outlookWebLink: true,
					},
				},
			},
		});

		return threads.map((thread) => ({
			id: thread.id,
			subject: thread.subject,
			lastMessageAt: thread.lastMessageAt.toISOString(),
			company: thread.company,
			contact: thread.contact
				? {
						id: thread.contact.id,
						name: [thread.contact.firstName, thread.contact.lastName]
							.filter(Boolean)
							.join(" "),
					}
				: null,
			lastMessage: thread.messages[0] ? messageOf(thread.messages[0]) : null,
		}));
	}

	async thread(userId: string, id: string) {
		const thread = await this.db.emailThread.findFirst({
			where: {
				id,
				messages: { some: { syncedByUserId: userId } },
			},
			select: {
				id: true,
				subject: true,
				lastMessageAt: true,
				company: { select: { id: true, name: true } },
				contact: {
					select: { id: true, firstName: true, lastName: true },
				},
				messages: {
					where: { syncedByUserId: userId },
					orderBy: { sentAt: "desc" },
					take: 100,
					select: {
						id: true,
						direction: true,
						fromEmail: true,
						fromName: true,
						snippet: true,
						body: true,
						sentAt: true,
						gmailMessageId: true,
						outlookWebLink: true,
					},
				},
			},
		});

		if (!thread) throw new NotFoundException("No inbox thread with that id.");

		const messages = thread.messages.map(messageOf);
		return {
			id: thread.id,
			subject: thread.subject,
			lastMessageAt: thread.lastMessageAt.toISOString(),
			company: thread.company,
			contact: thread.contact
				? {
						id: thread.contact.id,
						name: [thread.contact.firstName, thread.contact.lastName]
							.filter(Boolean)
							.join(" "),
					}
				: null,
			lastMessage: messages[0] ?? null,
			messages: messages.reverse(),
		};
	}
}
