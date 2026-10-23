import { defineTool } from "eve/tools";
import { z } from "zod";
import {
	CONTEXT_DEV_PEOPLE,
	CONTEXT_DEV_SOURCE,
	enabled,
	unavailable,
} from "../lib/capabilities";
import { contactProfileSlug, readCrmHistory } from "../lib/crm";
import { spend } from "../lib/focus";
import { personByProfileUrl } from "../lib/people";

export default defineTool({
	description:
		"Read the LinkedIn profile already on a CRM contact — bio, current role and full work history. For writing a summary of somebody already identified. Cannot be used to identify anyone: use resolve_linkedin_profile and get_linkedin_profile for that.",
	inputSchema: z.object({
		contactId: z.string(),
	}),
	async execute({ contactId }) {
		if (!(await enabled(CONTEXT_DEV_PEOPLE))) {
			const history = await readCrmHistory(contactId, { threads: 5 });
			if (!history)
				return { found: false as const, reason: "No such contact." };
			return {
				found: false as const,
				...unavailable(CONTEXT_DEV_SOURCE),
				crmRole: {
					title: history.contact.title,
					companyName: history.contact.companyName,
					source:
						"CRM contact record; check email signatures before relying on it",
				},
				pastRoles: [],
				unknown: "Earlier roles and LinkedIn profile details are unverified.",
				next: "Use read_crm_history for direct email evidence. Use public company pages only for claims they state.",
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
