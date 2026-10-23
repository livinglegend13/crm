import { defineTool } from "eve/tools";
import { z } from "zod";
import { CONTEXT_DEV_PEOPLE, enabled } from "../lib/capabilities";
import { contactProfileSlug, readCrmHistory } from "../lib/crm";
import { spend } from "../lib/focus";
import { personByProfileUrl } from "../lib/people";
import { researchPublicPerson } from "../lib/public-person";

export default defineTool({
	description:
		"Read work history for an identified CRM contact. Context supplies structured LinkedIn history when available. Otherwise, inspect public pages tied to the saved profile or employer. Return only source-backed roles.",
	inputSchema: z.object({
		contactId: z.string(),
	}),
	async execute({ contactId }) {
		if (!(await enabled(CONTEXT_DEV_PEOPLE))) {
			const history = await readCrmHistory(contactId, { threads: 5 });
			if (!history)
				return { found: false as const, reason: "No such contact." };
			const profileRef = await contactProfileSlug(contactId);
			const publicHistory = await researchPublicPerson(
				{
					fullName: history.contact.fullName,
					profileUrl: profileRef?.profileUrl ?? null,
					employerDomain: history.contact.company?.domain ?? null,
				},
				() => spend(1),
			);
			return {
				found: publicHistory.outcome === "found",
				contextAvailable: false,
				crmRole: {
					title: history.contact.title,
					companyName: history.contact.companyName,
					source:
						"CRM contact record; check email signatures before relying on it",
				},
				publicRoles:
					publicHistory.outcome === "found" ? publicHistory.roles : [],
				pastRoles: [],
				unknown:
					publicHistory.outcome === "skipped"
						? publicHistory.reason
						: "Other roles remain unverified.",
				next: "Use read_crm_history for direct email evidence. Public roles include exact quotes and URLs.",
			};
		}

		const profileRef = await contactProfileSlug(contactId);
		if (!profileRef) {
			return {
				found: false as const,
				reason: "This contact has no LinkedIn URL on file.",
			};
		}

		const charge = spend(2);
		if (!charge.ok) return { found: false as const, reason: charge.reason };

		const result = await personByProfileUrl(profileRef.profileUrl);
		if (result.outcome !== "found") {
			return { found: false as const, reason: result.reason };
		}

		return {
			found: true as const,
			profile: result.person,
			sourceUrl: profileRef.profileUrl,
			note: "Everything here is self-reported by the person. Write only what it says.",
		};
	},
});
