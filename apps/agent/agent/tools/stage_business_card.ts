import { db } from "@crm/db";
import {
	businessCardExtraction,
	businessCardRequest,
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
		const capture = await db.businessCardCapture.upsert({
			where: { submissionId },
			create: {
				submissionId,
				userId,
				extraction,
				meetingNote: request.meetingNote,
				recentlyMet: request.recentlyMet,
				autoSend: request.autoSend && request.recentlyMet,
			},
			update: {},
			select: { id: true, status: true },
		});
		return {
			captureId: capture.id,
			status: capture.status,
			extraction,
			recentlyMet: request.recentlyMet,
			autoSend: request.autoSend && request.recentlyMet,
			message:
				"Review the scanned details before adding this contact to the CRM.",
		};
	},
});
