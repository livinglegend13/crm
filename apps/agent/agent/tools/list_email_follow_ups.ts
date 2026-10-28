import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { requireAttribute } from "../lib/session-purpose";

export default defineTool({
	description:
		"List the signed-in CRM user's prospect email follow-ups. Use this for unanswered prospect emails, whose turn it is, or overdue replies. Read-only and scoped to the private chat owner. Paginate with cursor until the requested scope is complete.",
	inputSchema: z.object({
		owner: z.enum(["ME", "THEM", "ALL"]).default("ME"),
		limit: z.number().int().min(1).max(50).default(25),
		cursor: z.string().optional(),
	}),
	async execute({ owner, limit, cursor }, ctx) {
		const conversationId = requireAttribute(ctx, "conversationId");
		const conversation = await db.agentConversation.findUnique({
			where: { id: conversationId },
			select: { userId: true, kind: true },
		});
		if (conversation?.kind !== "BUILDER") {
			throw new Error("A private CRM chat is required.");
		}
		const rows = await db.emailFollowUp.findMany({
			where: {
				userId: conversation.userId,
				relevance: "RELEVANT",
				dismissedAt: null,
				...(owner === "ALL" ? {} : { owner }),
				thread: {
					feedback: {
						none: {
							userId: conversation.userId,
							label: { in: ["NOT_RELEVANT", "SPAM"] },
						},
					},
				},
			},
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
			take: limit + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			select: {
				id: true,
				owner: true,
				reason: true,
				dueAt: true,
				confidence: true,
				thread: {
					select: {
						id: true,
						subject: true,
						company: { select: { name: true } },
						contact: {
							select: { firstName: true, lastName: true, email: true },
						},
						messages: {
							where: { syncedByUserId: conversation.userId },
							orderBy: { sentAt: "desc" },
							take: 1,
							select: { direction: true, fromEmail: true, sentAt: true },
						},
					},
				},
			},
		});
		const page = rows.slice(0, limit);
		return {
			followUps: page.map((row) => ({
				threadId: row.thread.id,
				subject: row.thread.subject,
				company: row.thread.company?.name ?? null,
				contact: row.thread.contact
					? {
							name: [row.thread.contact.firstName, row.thread.contact.lastName]
								.filter(Boolean)
								.join(" "),
							email: row.thread.contact.email,
						}
					: null,
				owner: row.owner,
				reason: row.reason,
				dueAt: row.dueAt?.toISOString() ?? null,
				confidence: row.confidence,
				latestMessage: row.thread.messages[0]
					? {
							direction: row.thread.messages[0].direction,
							fromEmail: row.thread.messages[0].fromEmail,
							sentAt: row.thread.messages[0].sentAt.toISOString(),
						}
					: null,
			})),
			nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
		};
	},
});
