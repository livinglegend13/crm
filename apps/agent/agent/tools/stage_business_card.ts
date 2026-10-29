import { db } from "@crm/db";
import {
	businessCardExtraction,
	businessCardRequest,
	businessCardThankYou,
} from "@crm/validation/business-card";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { purposeOf, requireAttribute } from "../lib/session-purpose";

const submissionMessage = z.object({ text: z.string() });

export default defineTool({
	description:
		"Stage details read from the attached business card photo for human review. Never guess unreadable fields. Only use for a business card capture request with an image. This tool does not create contacts or send email.",
	inputSchema: businessCardExtraction,
	async execute(input, ctx) {
		if (purposeOf(ctx) !== "builder") {
			throw new Error("A private CRM chat is required.");
		}
		const submissionId = requireAttribute(ctx, "submissionId");
		const conversationId = requireAttribute(ctx, "conversationId");
		const userId = requireAttribute(ctx, "userId");
		const submission = await db.agentConversationSubmission.findFirst({
			where: {
				id: submissionId,
				conversationId,
				conversation: { userId, kind: "BUILDER" },
			},
			select: {
				message: true,
				attachments: { select: { mediaType: true } },
			},
		});
		if (!submission) throw new Error("This private chat is unavailable.");
		if (
			!submission.attachments.some((attachment) =>
				["image/jpeg", "image/png", "image/webp"].includes(
					attachment.mediaType,
				),
			)
		) {
			throw new Error("Attach a JPEG, PNG, or WebP business card photo.");
		}
		const message = submissionMessage.parse(submission.message);
		const [header, encoded] = message.text.split("\n", 2);
		if (header !== "Business card capture request" || !encoded) {
			throw new Error("Use the business card capture form.");
		}
		const request = businessCardRequest.parse(JSON.parse(encoded));
		const extraction = businessCardExtraction.parse(input);
		const websiteDomain = extraction.website
			? new URL(extraction.website).hostname.replace(/^www\./, "").toLowerCase()
			: null;
		const matches = await db.contact.findMany({
			where: {
				archivedAt: null,
				OR: [
					...(extraction.email
						? [
								{
									email: {
										equals: extraction.email,
										mode: "insensitive" as const,
									},
								},
							]
						: []),
					{
						company: {
							OR: [
								{
									name: { equals: extraction.companyName, mode: "insensitive" },
								},
								...(websiteDomain ? [{ domain: websiteDomain }] : []),
							],
						},
						OR: [
							...(extraction.phone ? [{ phone: extraction.phone }] : []),
							{
								firstName: {
									equals: extraction.firstName,
									mode: "insensitive",
								},
								lastName: extraction.lastName
									? { equals: extraction.lastName, mode: "insensitive" }
									: null,
							},
						],
					},
				],
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				phone: true,
				company: { select: { name: true } },
			},
			take: 5,
		});
		const matchCandidates = matches.map((contact) => ({
			id: contact.id,
			name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
			companyName: contact.company?.name ?? "Unknown company",
			email: contact.email,
			reason:
				contact.email &&
				extraction.email?.toLowerCase() === contact.email.toLowerCase()
					? "email"
					: contact.phone && extraction.phone === contact.phone
						? "phone"
						: "name",
		}));
		const user = await db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { name: true },
		});
		const draft = businessCardThankYou(extraction.firstName, user.name);
		const capture = await db.$transaction(async (tx) => {
			const saved = await tx.businessCardCapture.upsert({
				where: { submissionId },
				create: {
					submissionId,
					userId,
					extraction,
					matchCandidates,
					meetingNote: request.meetingNote,
					recentlyMet: request.recentlyMet,
					autoSend: request.autoSend && request.recentlyMet,
					subject: draft.subject,
					body: draft.body,
				},
				update: {},
				select: { id: true, status: true },
			});
			await tx.agentConversationAttachment.deleteMany({
				where: { submissionId },
			});
			return saved;
		});
		return {
			captureId: capture.id,
			status: capture.status,
			extraction,
			matchCandidates,
			recentlyMet: request.recentlyMet,
			autoSend: request.autoSend && request.recentlyMet,
			message:
				"The scan is staged, not saved. Open Scan business cards in the CRM and select Save contact and queue email after checking the details. Automatic sending starts after email verification. Do not confirm in chat; chat cannot save or send this card.",
		};
	},
});
