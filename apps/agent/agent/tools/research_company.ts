import { ActivityType, db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkCyberExposure, cyberExposureText } from "../lib/cyber-exposure";
import { CYBER_EXPOSURE } from "../lib/cyber-exposure-config";
import { spend } from "../lib/focus";
import { researchPublicCompany } from "../lib/public-company-research";

export default defineTool({
	description:
		"Read public company pages with Azure OpenAI and write a cited research brief to its timeline. Leave unsupported facts unknown.",
	inputSchema: z.object({
		companyId: z.string(),
	}),
	async execute({ companyId }) {
		const company = await db.company.findUnique({
			where: { id: companyId },
			select: {
				id: true,
				name: true,
				domain: true,
				website: true,
				ownerId: true,
			},
		});

		if (!company)
			return { written: false as const, reason: "No such company." };

		const author =
			company.ownerId ??
			(await db.user.findFirst({ select: { id: true } }))?.id ??
			null;
		let exposureActivityId: string | null = null;
		if (company.domain && author) {
			const recent = await db.activity.findFirst({
				where: {
					companyId,
					subject: `Cyber exposure check — ${company.domain}`,
					occurredAt: {
						gte: new Date(
							Date.now() -
								CYBER_EXPOSURE.refresh.days * CYBER_EXPOSURE.refresh.dayMs,
						),
					},
				},
				select: { id: true },
			});
			if (recent) exposureActivityId = recent.id;
			else {
				const contacts = await db.contact.findMany({
					where: {
						companyId,
						email: { endsWith: `@${company.domain}`, mode: "insensitive" },
					},
					select: { email: true },
					take: CYBER_EXPOSURE.contacts.maxPerCompany,
				});
				const exposure = await checkCyberExposure(
					company.domain,
					contacts.flatMap((contact) => (contact.email ? [contact.email] : [])),
				);
				const saved = await db.activity.create({
					data: {
						type: ActivityType.ENRICHMENT,
						subject: `Cyber exposure check — ${company.domain}`,
						body: cyberExposureText(exposure),
						occurredAt: new Date(exposure.checkedAt),
						companyId,
						createdById: author,
						meta: {
							source: "public-cyber-exposure",
							providers: exposure.checks.map((check) => check.source),
						},
					},
					select: { id: true },
				});
				exposureActivityId = saved.id;
			}
		}

		const url =
			company.website ?? (company.domain ? `https://${company.domain}` : null);

		if (!url) {
			return {
				written: false as const,
				reason: "This company has no website.",
			};
		}

		const result = await researchPublicCompany(company.name, url, () =>
			spend(2),
		);

		if (result.outcome === "skipped") {
			return {
				written: false as const,
				reason: result.reason,
				exposureActivityId,
			};
		}

		if (!author)
			return { written: false as const, reason: "No user to attribute to." };

		const activity = await db.activity.create({
			data: {
				type: ActivityType.ENRICHMENT,
				subject: `Research brief — ${company.name}`,
				body: result.text,
				occurredAt: new Date(),
				companyId: company.id,
				createdById: author,
				meta: {
					source: "public-company-pages",
					model: "azure-openai",
					sourceUrls: result.sourceUrls,
					agent: "people-research",
				},
			},
			select: { id: true },
		});

		await db.company.update({
			where: { id: companyId },
			data: { lastActivityAt: new Date() },
		});

		return {
			written: true as const,
			activityId: activity.id,
			exposureActivityId,
			sources: result.sourceUrls,
		};
	},
});
