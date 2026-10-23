import { describe, expect, it } from "bun:test";
import { formatBrief } from "../agent/lib/public-company-research";

describe("public company research citations", () => {
	it("keeps exact page evidence and drops unsupported claims", () => {
		const text = formatBrief(
			{
				positioning: {
					text: "Acme sells storage software.",
					evidenceQuote: "storage software for enterprises",
					sourceIndex: 0,
				},
				pricingModel: {
					text: "Charges per terabyte.",
					evidenceQuote: "per terabyte",
					sourceIndex: 0,
				},
				targetCustomer: null,
				notableCustomers: [],
				recentNews: [],
			},
			[
				{
					url: "https://acme.example/",
					text: "We make storage software for enterprises.",
					retrievedAt: "2026-10-23T00:00:00.000Z",
				},
			],
		);
		expect(text).toContain(
			"Acme sells storage software. [https://acme.example/]",
		);
		expect(text).not.toContain("Charges per terabyte.");
	});
});
