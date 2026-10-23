import { describe, expect, it } from "bun:test";
import { publicBrandFromHtml } from "../agent/lib/public-brand";
import { supportedRoles } from "../agent/lib/public-person";

describe("public enrichment", () => {
	it("uses homepage metadata and refuses an off-site image", () => {
		const brand = publicBrandFromHtml(
			'<title>Acme</title><meta content="Storage for teams" name="description"><meta property="og:image" content="https://other.example/hero.png"><img class="brand-logo" src="https://other.example/logo.png"><link rel="icon" href="/favicon.ico">',
			"https://acme.example/",
		);
		expect(brand?.title).toBe("Acme");
		expect(brand?.description).toBe("Storage for teams");
		expect(brand?.logos).toEqual([
			{ url: "https://acme.example/favicon.ico", type: "icon", mode: "light" },
		]);
	});

	it("drops a role without an exact source quote", () => {
		const roles = supportedRoles(
			[
				{
					title: "VP",
					company: "Acme",
					dates: null,
					evidenceQuote: "VP at Acme since 2020",
					sourceIndex: 0,
				},
				{
					title: "CEO",
					company: "Other",
					dates: null,
					evidenceQuote: "CEO at Other since 2018",
					sourceIndex: 0,
				},
			],
			[
				{
					url: "https://acme.example/team",
					text: "Jane Smith is VP at Acme since 2020.",
				},
			],
		);
		expect(roles).toHaveLength(1);
		expect(roles[0]?.sourceUrl).toBe("https://acme.example/team");
	});
});
