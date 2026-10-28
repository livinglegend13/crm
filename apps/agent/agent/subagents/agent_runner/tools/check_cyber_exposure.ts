import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkCyberExposure } from "../../../lib/cyber-exposure";
import { CYBER_EXPOSURE } from "../../../lib/cyber-exposure-config";
import { readRunRecord } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"Check public cyber exposure signals for the approved company domain and up to three known work addresses. Return counts, dates, and source status only. These signals are not breach probability or proof of a company breach.",
	inputSchema: z.object({ companyId: z.string().min(1) }),
	async execute({ companyId }, ctx) {
		await readRunRecord(requireTeamAgentAttribute(ctx, "runId"), {
			kind: "company",
			id: companyId,
		});
		const company = await db.company.findUnique({
			where: { id: companyId },
			select: { domain: true },
		});
		if (!company?.domain)
			return {
				available: false as const,
				reason: "Company domain is missing.",
			};
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
			orderBy: { occurredAt: "desc" },
			select: { body: true, occurredAt: true },
		});
		if (recent)
			return {
				available: true as const,
				cached: true as const,
				checkedAt: recent.occurredAt?.toISOString() ?? null,
				summary: recent.body,
			};
		const contacts = await db.contact.findMany({
			where: {
				companyId,
				email: { endsWith: `@${company.domain}`, mode: "insensitive" },
			},
			select: { email: true },
			take: CYBER_EXPOSURE.contacts.maxPerCompany,
		});
		const result = await checkCyberExposure(
			company.domain,
			contacts.flatMap((contact) => (contact.email ? [contact.email] : [])),
		);
		return { available: true as const, ...result };
	},
});
