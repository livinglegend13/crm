import { describe, expect, it } from "bun:test";
import { companyRecordIssues } from "../src/company-health";

describe("company record issues", () => {
	it("identifies fields that block a usable company record", () => {
		expect(
			companyRecordIssues({
				country: null,
				countryCode: null,
				email: "invalid",
				website: "not-a-url",
			}).map((issue) => issue.field),
		).toEqual(["country", "email", "website"]);
		expect(
			companyRecordIssues({
				country: "IN",
				countryCode: null,
				email: null,
				website: "https://terraeagle.com",
			}),
		).toEqual([]);
	});
});
