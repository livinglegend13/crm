import type { Db } from "@crm/db";
import type {
	inboxFollowUpAction,
	inboxThreadFeedbackInput,
	inboxThreadListInput,
} from "@crm/validation/inbox";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { outreachSenders } from "../microsoft/sender-mailboxes";
import { INBOX } from "./inbox.config";
import { messageMailboxes } from "./inbox-mailboxes";

function subjectKey(value: string | null): string {
	return (value ?? "")
		.replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/gi, "")
		.trim()
		.toLowerCase();
}

function groupKey(thread: {
	id: string;
	contactId: string | null;
	companyId: string | null;
	subject: string | null;
	messages: { direction: string; fromEmail: string }[];
}): string {
	const subject = subjectKey(thread.subject);
	if (!subject) return thread.id;
	if (thread.contactId) return `${thread.contactId}:${subject}`;
	const sender = thread.messages
		.find((message) => message.direction === "INBOUND")
		?.fromEmail.toLowerCase();
	return thread.companyId && sender
		? `${thread.companyId}:${sender}:${subject}`
		: thread.id;
}

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
			where: {
				userId,
				relevance: { in: ["RELEVANT", "UNASSESSED"] },
				thread: {
					feedback: {
						none: { userId, label: { in: ["NOT_RELEVANT", "SPAM"] } },
					},
					messages: {
						some: { syncedByUserId: userId, direction: "OUTBOUND" },
					},
				},
			},
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
				relevance: true,
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
		const mapped = rows.map((row) => ({
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
			relevance:
				row.relevance === "NOT_RELEVANT"
					? ("NOT_RELEVANT" as const)
					: ("RELEVANT" as const),
			snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
			dismissedAt: row.dismissedAt?.toISOString() ?? null,
			lastMessageAt: row.thread.lastMessageAt.toISOString(),
			lastMessage: row.thread.messages[0]
				? messageOf(row.thread.messages[0])
				: null,
		}));
		const seen = new Set<string>();
		return mapped
			.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
			.filter((row) => {
				const key = row.contact
					? `${row.contact.id}:${subjectKey(row.subject)}`
					: row.threadId;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.sort((a, b) =>
				(a.dueAt ?? a.lastMessageAt).localeCompare(b.dueAt ?? b.lastMessageAt),
			);
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

	async list(userId: string, input: z.infer<typeof inboxThreadListInput>) {
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true },
		});
		const knownAddresses = new Set([
			user.email.toLowerCase(),
			...outreachSenders(),
		]);
		const feedback = await this.db.emailThreadFeedback.findMany({
			where: { userId, label: { in: ["NOT_RELEVANT", "SPAM"] } },
			select: { senderEmail: true },
		});
		const hiddenSenders = new Set(feedback.map((row) => row.senderEmail));
		const threads = await this.db.emailThread.findMany({
			where: { messages: { some: { syncedByUserId: userId } } },
			orderBy: { lastMessageAt: "desc" },
			take: INBOX.maxThreads,
			select: {
				id: true,
				subject: true,
				firstMessageAt: true,
				messageCount: true,
				contactId: true,
				companyId: true,
				lastMessageAt: true,
				feedback: { where: { userId }, select: { label: true } },
				followUps: { where: { userId }, select: { relevance: true } },
				company: { select: { id: true, name: true } },
				contact: {
					select: { id: true, firstName: true, lastName: true },
				},
				messages: {
					where: { syncedByUserId: userId },
					orderBy: { sentAt: "desc" },
					take: 10,
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
						recipients: true,
					},
				},
			},
		});

		const groups: (typeof threads)[] = [];
		for (const thread of threads) {
			const key = groupKey(thread);
			const group = groups.find((rows) => {
				const first = rows[0];
				if (!first) return false;
				const firstKey = groupKey(first);
				return (
					firstKey === key &&
					first.lastMessageAt.getTime() - thread.lastMessageAt.getTime() <=
						INBOX.groupWindowDays * INBOX.dayMs
				);
			});
			if (group) group.push(thread);
			else groups.push([thread]);
		}
		const filtered = groups.filter((rows) => {
			if (
				input.mailbox &&
				!rows.some((row) =>
					row.messages.some((message) =>
						messageMailboxes(message, knownAddresses).includes(
							input.mailbox ?? "",
						),
					),
				)
			)
				return false;
			const restored = rows.some((row) =>
				row.feedback.some((item) => item.label === "RELEVANT"),
			);
			if (restored) return input.view === "ACTIVE";
			const explicit = rows.some((row) =>
				row.feedback.some(
					(item) => item.label === "NOT_RELEVANT" || item.label === "SPAM",
				),
			);
			const inbound = rows
				.flatMap((row) => row.messages)
				.find((message) => message.direction === "INBOUND");
			const inherited = inbound
				? hiddenSenders.has(inbound.fromEmail.toLowerCase())
				: false;
			const classified = rows.some((row) =>
				row.followUps.some((item) => item.relevance === "NOT_RELEVANT"),
			);
			const hidden = explicit || inherited || classified;
			return input.view === "HIDDEN" ? hidden : !hidden;
		});
		const total = filtered.length;
		const pageRows = filtered.slice(
			(input.page - 1) * INBOX.pageSize,
			input.page * INBOX.pageSize,
		);
		return {
			mailboxes: [...knownAddresses].sort(),
			items: pageRows.map((rows) => {
				const thread = rows[0];
				if (!thread) throw new Error("Empty inbox conversation group.");
				const label = rows
					.flatMap((row) => row.feedback)
					.find(
						(row) => row.label === "SPAM" || row.label === "NOT_RELEVANT",
					)?.label;
				return {
					id: thread.id,
					mailboxAddresses: [
						...new Set(
							rows.flatMap((row) =>
								row.messages.flatMap((message) =>
									messageMailboxes(message, knownAddresses),
								),
							),
						),
					].sort(),
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
					lastMessage: thread.messages[0]
						? messageOf(thread.messages[0])
						: null,
					messageCount: rows.reduce(
						(count, row) => count + row.messageCount,
						0,
					),
					feedback:
						label === "SPAM"
							? ("SPAM" as const)
							: label === "NOT_RELEVANT"
								? ("NOT_RELEVANT" as const)
								: null,
				};
			}),
			page: input.page,
			totalPages: Math.max(1, Math.ceil(total / INBOX.pageSize)),
			total,
		};
	}

	async feedback(
		userId: string,
		input: z.infer<typeof inboxThreadFeedbackInput>,
	) {
		const thread = await this.db.emailThread.findFirst({
			where: {
				id: input.threadId,
				messages: { some: { syncedByUserId: userId } },
			},
			select: {
				id: true,
				subject: true,
				contactId: true,
				companyId: true,
				lastMessageAt: true,
				messages: {
					where: { syncedByUserId: userId, direction: "INBOUND" },
					orderBy: { sentAt: "desc" },
					take: 1,
					select: { direction: true, fromEmail: true },
				},
			},
		});
		if (!thread) throw new NotFoundException("No inbox thread with that id.");
		const senderEmail = thread.messages[0]?.fromEmail.toLowerCase() ?? "";
		const candidates =
			thread.contactId || thread.companyId
				? await this.db.emailThread.findMany({
						where: {
							...(thread.contactId
								? { contactId: thread.contactId }
								: { companyId: thread.companyId }),
							lastMessageAt: {
								gte: new Date(
									thread.lastMessageAt.getTime() -
										INBOX.groupWindowDays * INBOX.dayMs,
								),
								lte: new Date(
									thread.lastMessageAt.getTime() +
										INBOX.groupWindowDays * INBOX.dayMs,
								),
							},
							messages: { some: { syncedByUserId: userId } },
						},
						select: {
							id: true,
							contactId: true,
							companyId: true,
							subject: true,
							messages: {
								where: { syncedByUserId: userId, direction: "INBOUND" },
								orderBy: { sentAt: "desc" },
								take: 1,
								select: { direction: true, fromEmail: true },
							},
						},
					})
				: [thread];
		const threadIds = candidates
			.filter((row) => groupKey(row) === groupKey(thread))
			.map((row) => row.id);
		if (threadIds.length === 0) threadIds.push(thread.id);
		if (input.label === "RESTORE") {
			await this.db.$transaction(
				threadIds.map((threadId) =>
					this.db.emailThreadFeedback.upsert({
						where: { userId_threadId: { userId, threadId } },
						create: {
							userId,
							threadId,
							label: "RELEVANT",
							senderEmail,
							subject: thread.subject,
						},
						update: { label: "RELEVANT" },
					}),
				),
			);
			await this.db.emailFollowUp.updateMany({
				where: { userId, threadId: { in: threadIds } },
				data: { relevance: "RELEVANT", dismissedAt: null },
			});
			return { updated: true };
		}
		await this.db.$transaction(
			threadIds.map((threadId) =>
				this.db.emailThreadFeedback.upsert({
					where: { userId_threadId: { userId, threadId } },
					create: {
						userId,
						threadId,
						label: input.label,
						senderEmail,
						subject: thread.subject,
					},
					update: { label: input.label, senderEmail, subject: thread.subject },
				}),
			),
		);
		await this.db.emailFollowUp.updateMany({
			where: { userId, threadId: { in: threadIds } },
			data: { dismissedAt: new Date(), relevance: "NOT_RELEVANT" },
		});
		return { updated: true };
	}

	async thread(userId: string, id: string) {
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true },
		});
		const knownAddresses = new Set([
			user.email.toLowerCase(),
			...outreachSenders(),
		]);
		const thread = await this.db.emailThread.findFirst({
			where: {
				id,
				messages: { some: { syncedByUserId: userId } },
			},
			select: {
				id: true,
				subject: true,
				contactId: true,
				companyId: true,
				messageCount: true,
				lastMessageAt: true,
				feedback: { where: { userId }, select: { label: true } },
				company: { select: { id: true, name: true } },
				contact: {
					select: { id: true, firstName: true, lastName: true },
				},
				messages: {
					where: { syncedByUserId: userId },
					orderBy: { sentAt: "desc" },
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
						recipients: true,
					},
				},
			},
		});

		if (!thread) throw new NotFoundException("No inbox thread with that id.");

		const related =
			thread.contactId || thread.companyId
				? await this.db.emailThread.findMany({
						where: {
							...(thread.contactId
								? { contactId: thread.contactId }
								: { companyId: thread.companyId }),
							lastMessageAt: {
								gte: new Date(
									thread.lastMessageAt.getTime() -
										INBOX.groupWindowDays * INBOX.dayMs,
								),
								lte: new Date(
									thread.lastMessageAt.getTime() +
										INBOX.groupWindowDays * INBOX.dayMs,
								),
							},
							messages: { some: { syncedByUserId: userId } },
						},
						select: {
							id: true,
							subject: true,
							contactId: true,
							companyId: true,
							messageCount: true,
							messages: {
								where: { syncedByUserId: userId },
								orderBy: { sentAt: "desc" },
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
									recipients: true,
								},
							},
						},
					})
				: [];
		const grouped = related.filter((row) => groupKey(row) === groupKey(thread));
		const messages = (
			grouped.length ? grouped.flatMap((row) => row.messages) : thread.messages
		)
			.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
			.map(messageOf);
		const label = thread.feedback[0]?.label;
		return {
			id: thread.id,
			mailboxAddresses: [
				...new Set(
					(grouped.length ? grouped : [thread]).flatMap((row) =>
						row.messages.flatMap((message) =>
							messageMailboxes(message, knownAddresses),
						),
					),
				),
			].sort(),
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
			lastMessage: messages.at(-1) ?? null,
			messageCount: grouped.length
				? grouped.reduce((count, row) => count + row.messageCount, 0)
				: thread.messageCount,
			feedback:
				label === "SPAM"
					? ("SPAM" as const)
					: label === "NOT_RELEVANT"
						? ("NOT_RELEVANT" as const)
						: null,
			messages,
		};
	}
}
