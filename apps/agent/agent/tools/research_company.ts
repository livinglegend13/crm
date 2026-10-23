import { ActivityType, db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
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
			return { written: false as const, reason: result.reason };
		}

		const author =
			company.ownerId ??
			(await db.user.findFirst({ select: { id: true } }))?.id ??
			null;

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
			sources: result.sourceUrls,
		};
	},
});
