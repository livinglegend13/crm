import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { CRM_AUDIT } from "../../../lib/crm-audit-config";
import { runContext } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"Count every active company and deal, then page through records without direct contacts. This is a complete database audit, not search results.",
	inputSchema: z.object({
		companyCursor: z.string().optional(),
		dealCursor: z.string().optional(),
	}),
	async execute(input, ctx) {
		const run = await runContext(requireTeamAgentAttribute(ctx, "runId"));
		if (run.recordScope !== "WORKSPACE") {
			throw new Error("A full CRM audit needs workspace record access.");
		}

		const companyWhere = { archivedAt: null, contacts: { none: {} } } as const;
		const dealWhere = { archivedAt: null, contacts: { none: {} } } as const;
		const [
			companyCount,
			dealCount,
			contactlessCompanyCount,
			contactlessDealCount,
			companies,
			deals,
		] = await Promise.all([
			db.company.count({ where: { archivedAt: null } }),
			db.deal.count({ where: { archivedAt: null } }),
			db.company.count({ where: companyWhere }),
			db.deal.count({ where: dealWhere }),
			db.company.findMany({
				where: { ...companyWhere, id: { gt: input.companyCursor } },
				orderBy: { id: "asc" },
				take: CRM_AUDIT.pageSize + 1,
				select: { id: true, name: true, country: true, domain: true },
			}),
			db.deal.findMany({
				where: { ...dealWhere, id: { gt: input.dealCursor } },
				orderBy: { id: "asc" },
				take: CRM_AUDIT.pageSize + 1,
				select: { id: true, name: true, companyId: true },
			}),
		]);
		const companyPage = companies.slice(0, CRM_AUDIT.pageSize);
		const dealPage = deals.slice(0, CRM_AUDIT.pageSize);

		return {
			companiesScanned: companyCount,
			dealsScanned: dealCount,
			contactlessCompanyCount,
			contactlessDealCount,
			companies: companyPage,
			deals: dealPage,
			nextCompanyCursor:
				companies.length > CRM_AUDIT.pageSize ? companyPage.at(-1)?.id : null,
			nextDealCursor:
				deals.length > CRM_AUDIT.pageSize ? dealPage.at(-1)?.id : null,
		};
	},
});
