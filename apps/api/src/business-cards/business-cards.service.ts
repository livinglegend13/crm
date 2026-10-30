import { MICROSOFT_PROVIDER_ID, OUTLOOK_SEND_SHARED_SCOPE } from "@crm/auth";
import type { Db } from "@crm/db";
import {
	businessCardExtraction,
	businessCardMatchCandidates,
	businessCardMessageInput,
	businessCardSendInput,
	businessCardThankYou,
	confirmBusinessCardInput,
} from "@crm/validation/business-card";
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { InjectDatabase } from "../database/database.constants";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";
import { GraphClient } from "../microsoft/graph.client";
import { BUSINESS_CARDS } from "./business-cards.config";

const CAMPAIGN_NAME = "Conference and impromptu visits";
const SERVICE_SLUG = "relationship-follow-up";

@Injectable()
export class BusinessCardsService {
	private readonly logger = new Logger(BusinessCardsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly graph: GraphClient,
	) {}

	async purgeExpiredImages(): Promise<number> {
		const cutoff = new Date(Date.now() - BUSINESS_CARDS.imageRetentionMs);
		return this.db.$executeRaw`
			DELETE FROM "agentConversationAttachment" AS attachment
			USING "agentConversationSubmission" AS submission
			WHERE attachment."submissionId" = submission.id
				AND attachment."createdAt" < ${cutoff}
				AND attachment."mediaType" LIKE 'image/%'
				AND submission.message->>'text' LIKE 'Business card capture request%'
		`;
	}

	async list(userId: string) {
		const rows = await this.db.businessCardCapture.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			take: 100,
			select: {
				id: true,
				extraction: true,
				matchCandidates: true,
				meetingNote: true,
				recentlyMet: true,
				autoSend: true,
				status: true,
				contactId: true,
				campaignId: true,
				sendError: true,
				subject: true,
				body: true,
				senderEmail: true,
				user: { select: { name: true, email: true, emailSignature: true } },
				createdAt: true,
				sentAt: true,
			},
		});
		return rows.map((row) => {
			const extraction = businessCardExtraction.parse(row.extraction);
			const { user, ...saved } = row;
			const draft = businessCardThankYou(
				extraction.firstName,
				user.name,
				user.emailSignature,
			);
			return {
				...saved,
				extraction,
				matchCandidates: businessCardMatchCandidates.parse(row.matchCandidates),
				subject: row.subject ?? draft.subject,
				body: row.body ?? draft.body,
				senderEmail: row.senderEmail ?? user.email,
				createdAt: row.createdAt.toISOString(),
				sentAt: row.sentAt?.toISOString() ?? null,
			};
		});
	}

	async confirm(
		userId: string,
		input: z.infer<typeof confirmBusinessCardInput>,
	) {
		const capture = await this.db.businessCardCapture.findFirst({
			where: { id: input.id, userId },
			select: {
				id: true,
				status: true,
				contactId: true,
				matchCandidates: true,
			},
		});
		if (!capture) throw new NotFoundException("Card scan not found.");
		if (capture.status !== "REVIEW") {
			throw new ConflictException("This card scan was already saved.");
		}
		const extraction = businessCardExtraction.parse(input.extraction);
		const matchCandidates = businessCardMatchCandidates.parse(
			capture.matchCandidates,
		);
		if (
			input.existingContactId &&
			!matchCandidates.some((match) => match.id === input.existingContactId)
		) {
			throw new ConflictException(
				"This contact was not a card match. Review the scan again.",
			);
		}
		if (input.autoSend && (!input.recentlyMet || !extraction.email)) {
			throw new ConflictException(
				"Automatic thank-you requires a recent meeting and a work email.",
			);
		}
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true },
		});
		const countryCode = extraction.countryCode?.toUpperCase() ?? "IN";
		const websiteDomain = extraction.website
			? new URL(extraction.website).hostname.replace(/^www\./, "").toLowerCase()
			: null;
		const saved = await this.db.$transaction(async (tx) => {
			const claimed = await tx.businessCardCapture.updateMany({
				where: { id: input.id, userId, status: "REVIEW" },
				data: { status: "SAVING" },
			});
			if (claimed.count !== 1) {
				throw new ConflictException("This card scan was already saved.");
			}
			let company = websiteDomain
				? await tx.company.findFirst({
						where: { domain: websiteDomain, archivedAt: null },
						select: { id: true },
					})
				: null;
			company ??= await tx.company.findFirst({
				where: {
					name: { equals: extraction.companyName, mode: "insensitive" },
					archivedAt: null,
				},
				select: { id: true },
			});
			company ??= await tx.company.create({
				data: {
					name: extraction.companyName,
					domain: websiteDomain,
					website: extraction.website,
					countryCode,
					ownerId: userId,
				},
				select: { id: true },
			});
			let contact = input.existingContactId
				? await tx.contact.findFirst({
						where: { id: input.existingContactId, archivedAt: null },
						select: {
							id: true,
							companyId: true,
							email: true,
							lastName: true,
							phone: true,
							title: true,
						},
					})
				: null;
			if (input.existingContactId && !contact) {
				throw new ConflictException(
					"The matched contact is no longer available.",
				);
			}
			contact ??= extraction.email
				? await tx.contact.findFirst({
						where: {
							email: { equals: extraction.email, mode: "insensitive" },
							archivedAt: null,
						},
						select: {
							id: true,
							companyId: true,
							email: true,
							lastName: true,
							phone: true,
							title: true,
						},
					})
				: null;
			if (contact?.companyId && contact.companyId !== company.id) {
				throw new ConflictException(
					"This email belongs to a contact at another company. Review that contact first.",
				);
			}
			if (
				contact?.email &&
				extraction.email &&
				contact.email.toLowerCase() !== extraction.email.toLowerCase()
			) {
				throw new ConflictException(
					"The matched contact has a different email. Review the card address.",
				);
			}
			contact ??= await tx.contact.create({
				data: {
					firstName: extraction.firstName,
					lastName: extraction.lastName,
					email: extraction.email,
					phone: extraction.phone,
					title: extraction.title,
					companyId: company.id,
					ownerId: userId,
				},
				select: {
					id: true,
					companyId: true,
					email: true,
					lastName: true,
					phone: true,
					title: true,
				},
			});
			if (
				!contact.companyId ||
				(!contact.email && extraction.email) ||
				(!contact.lastName && extraction.lastName) ||
				(!contact.phone && extraction.phone) ||
				(!contact.title && extraction.title)
			) {
				await tx.contact.update({
					where: { id: contact.id },
					data: {
						companyId: contact.companyId ?? company.id,
						email: contact.email ?? extraction.email,
						lastName: contact.lastName ?? extraction.lastName,
						phone: contact.phone ?? extraction.phone,
						title: contact.title ?? extraction.title,
					},
				});
			}
			if (input.meetingNote || input.recentlyMet) {
				await tx.activity.create({
					data: {
						type: "NOTE",
						subject: input.recentlyMet ? "Met in person" : "Business card note",
						body: input.meetingNote,
						contactId: contact.id,
						companyId: company.id,
						createdById: userId,
						occurredAt: new Date(),
					},
				});
			}
			const service = await tx.gtmService.upsert({
				where: { slug: SERVICE_SLUG },
				create: {
					slug: SERVICE_SLUG,
					name: "Relationship follow-up",
					description:
						"Thank-you emails after conferences and in-person meetings.",
					marketCountryCodes: [countryCode],
				},
				update: {},
				select: { id: true },
			});
			let campaign = await tx.gtmCampaign.findFirst({
				where: {
					ownerId: userId,
					name: CAMPAIGN_NAME,
					marketCountryCode: countryCode,
				},
				select: { id: true },
			});
			campaign ??= await tx.gtmCampaign.create({
				data: {
					name: CAMPAIGN_NAME,
					ownerId: userId,
					serviceId: service.id,
					serviceLine: "CUSTOM",
					marketCountryCode: countryCode,
					status: "READY",
					description: "Contacts met at conferences and impromptu visits.",
				},
				select: { id: true },
			});
			await tx.gtmCampaignTarget.upsert({
				where: {
					campaignId_contactId: {
						campaignId: campaign.id,
						contactId: contact.id,
					},
				},
				create: {
					campaignId: campaign.id,
					companyId: company.id,
					contactId: contact.id,
				},
				update: {},
			});
			return tx.businessCardCapture.update({
				where: { id: capture.id },
				data: {
					extraction,
					meetingNote: input.meetingNote,
					recentlyMet: input.recentlyMet,
					autoSend: input.autoSend,
					contactId: contact.id,
					campaignId: campaign.id,
					senderEmail: user.email,
					recipientEmail: extraction.email,
					subject: input.subject,
					body: input.body,
					status: input.autoSend ? "PENDING_SEND" : "SAVED",
				},
				select: { id: true, status: true, contactId: true, campaignId: true },
			});
		});
		if (saved.status === "PENDING_SEND") {
			try {
				await this.sendDue(saved.id);
			} catch (error) {
				this.logger.error(
					"Business card email was not sent immediately",
					error,
				);
			}
		}
		return this.db.businessCardCapture.findUniqueOrThrow({
			where: { id: saved.id },
			select: { id: true, status: true, contactId: true, campaignId: true },
		});
	}

	async editMessage(
		userId: string,
		input: z.infer<typeof businessCardMessageInput>,
	) {
		const updated = await this.db.businessCardCapture.updateMany({
			where: { id: input.id, userId, status: "SAVED" },
			data: { subject: input.subject, body: input.body },
		});
		if (updated.count !== 1) {
			throw new ConflictException("This email is no longer editable.");
		}
		return { id: input.id };
	}

	async requestSend(
		userId: string,
		input: z.infer<typeof businessCardSendInput>,
	) {
		if (process.env.OUTREACH_SENDING_ENABLED !== "true") {
			throw new ConflictException("Email sending is disabled for this CRM.");
		}
		const card = await this.db.businessCardCapture.findFirst({
			where: { id: input.id, userId },
			select: {
				id: true,
				status: true,
				recentlyMet: true,
				recipientEmail: true,
				subject: true,
				body: true,
				contact: { select: { email: true, archivedAt: true } },
			},
		});
		if (!card) throw new NotFoundException("Card scan not found.");
		if (card.status !== "SAVED")
			throw new ConflictException(
				"This email has already entered the send queue.",
			);
		if (
			!card.recentlyMet ||
			!card.recipientEmail ||
			!card.subject ||
			!card.body ||
			card.contact?.archivedAt ||
			card.contact?.email?.toLowerCase() !== card.recipientEmail.toLowerCase()
		) {
			throw new ConflictException(
				"A recent meeting and a current contact email are required.",
			);
		}
		const claimed = await this.db.businessCardCapture.updateMany({
			where: { id: card.id, userId, status: "SAVED" },
			data: { status: "PENDING_SEND", autoSend: true },
		});
		if (claimed.count !== 1)
			throw new ConflictException(
				"This email has already entered the send queue.",
			);
		await this.sendDue(card.id);
		const updated = await this.db.businessCardCapture.findUniqueOrThrow({
			where: { id: card.id },
			select: { status: true },
		});
		return updated;
	}

	async retryUnknown(
		userId: string,
		input: z.infer<typeof businessCardSendInput>,
	) {
		if (process.env.OUTREACH_SENDING_ENABLED !== "true") {
			throw new ConflictException("Email sending is disabled for this CRM.");
		}
		const card = await this.db.businessCardCapture.findFirst({
			where: { id: input.id, userId },
			select: { id: true, status: true },
		});
		if (!card) throw new NotFoundException("Card scan not found.");
		if (card.status !== "SEND_UNKNOWN") {
			throw new ConflictException("This email does not need a retry.");
		}
		const claimed = await this.db.businessCardCapture.updateMany({
			where: { id: card.id, userId, status: "SEND_UNKNOWN" },
			data: { status: "PENDING_SEND", sendError: null },
		});
		if (claimed.count !== 1) {
			throw new ConflictException("Another retry started. Reload this card.");
		}
		await this.sendDue(card.id);
		return this.db.businessCardCapture.findUniqueOrThrow({
			where: { id: card.id },
			select: { status: true },
		});
	}

	async sendDue(cardId?: string) {
		if (process.env.OUTREACH_SENDING_ENABLED !== "true") return 0;
		const pending = await this.db.businessCardCapture.findMany({
			where: {
				autoSend: true,
				recentlyMet: true,
				OR: [
					{ status: { in: ["PENDING_SEND", "PENDING_VERIFICATION"] } },
					{
						status: "BLOCKED",
						sendError: "Email verification marked this address unsafe.",
					},
				],
				...(cardId ? { id: cardId } : {}),
			},
			orderBy: { createdAt: "asc" },
			take: 10,
			include: {
				user: { select: { email: true } },
				contact: true,
			},
		});
		let sent = 0;
		for (const card of pending) {
			if (
				!card.recipientEmail ||
				!card.senderEmail ||
				!card.body ||
				!card.subject
			)
				continue;
			if (
				card.contact?.archivedAt ||
				card.contact?.email?.toLowerCase() !== card.recipientEmail.toLowerCase()
			) {
				await this.db.businessCardCapture.update({
					where: { id: card.id },
					data: {
						status: "BLOCKED",
						sendError: "The contact email changed or the contact was archived.",
					},
				});
				continue;
			}
			if (card.senderEmail.toLowerCase() !== card.user.email.toLowerCase())
				continue;
			const scopes = await this.tokens.grantedScopes(
				card.userId,
				MICROSOFT_PROVIDER_ID,
			);
			if (!scopes.has(OUTLOOK_SEND_SHARED_SCOPE)) continue;
			const token = await this.tokens.accessTokenFor(card.userId, "outlook");
			if (token.outcome !== "ok") continue;
			const claimed = await this.db.businessCardCapture.updateMany({
				where: { id: card.id, status: card.status },
				data: { status: "SENDING", sendStartedAt: new Date() },
			});
			if (claimed.count !== 1) continue;
			let outcome: "accepted" | "rejected" | "unknown" = "unknown";
			try {
				outcome = await this.graph.sendMail(token.accessToken, {
					from: card.senderEmail,
					to: card.recipientEmail,
					subject: card.subject,
					body: card.body,
				});
			} catch (error) {
				this.logger.error("Business card send did not complete", error);
			}
			await this.db.businessCardCapture.update({
				where: { id: card.id },
				data:
					outcome === "accepted"
						? { status: "SENT", sentAt: new Date(), sendError: null }
						: outcome === "unknown"
							? {
									status: "SEND_UNKNOWN",
									sendError:
										"Microsoft did not confirm delivery. Check Sent Items before retrying.",
								}
							: {
									status: "BLOCKED",
									sendError:
										"Microsoft rejected this email. Reconnect the mailbox and review the address.",
								},
			});
			if (outcome === "accepted") sent += 1;
		}
		if (sent > 0)
			this.logger.log({
				message: "Business card thank-you emails accepted",
				count: sent,
			});
		return sent;
	}
}
