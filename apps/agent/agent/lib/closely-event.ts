import { ActivityType, db } from "@crm/db";
import { closelyEventTask } from "@crm/validation/closely";

export async function linkCloselyEvent(payload: unknown): Promise<string> {
	const { eventId } = closelyEventTask.parse(payload);
	const event = await db.closelyEvent.findUnique({ where: { id: eventId } });
	if (!event) return "Closely event is no longer available.";
	if (event.contactId) return "Closely event is already linked.";
	const emailMatch = event.email
		? await db.contact.findFirst({
				where: {
					email: { equals: event.email, mode: "insensitive" },
					archivedAt: null,
				},
				select: { id: true },
			})
		: null;
	const profileMatch = event.linkedinUrl
		? await db.contact.findFirst({
				where: { linkedinUrl: event.linkedinUrl, archivedAt: null },
				select: { id: true },
			})
		: null;
	if (emailMatch && profileMatch && emailMatch.id !== profileMatch.id)
		return "Email and LinkedIn point to different CRM contacts. Review the event.";
	const contactId = emailMatch?.id ?? profileMatch?.id;
	if (!contactId)
		return "No exact CRM contact match. The event stays in the Closely activity feed.";
	const author = await db.user.findFirst({
		orderBy: { createdAt: "asc" },
		select: { id: true },
	});
	if (!author) return "No CRM user can own this activity.";
	await db.$transaction(async (tx) => {
		const changed = await tx.closelyEvent.updateMany({
			where: { id: eventId, contactId: null },
			data: { contactId },
		});
		if (changed.count === 0) return;
		await tx.activity.create({
			data: {
				type: ActivityType.NOTE,
				subject: `Closely: ${event.trigger}`,
				body: event.campaignNames.length
					? `Campaigns: ${event.campaignNames.join(", ")}`
					: null,
				contactId,
				createdById: author.id,
				occurredAt: event.occurredAt ?? event.receivedAt,
				meta: { source: "closely", eventId },
			},
		});
	});
	return "Closely event linked to the contact activity.";
}
