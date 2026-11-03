import { describe, expect, it } from "bun:test";
import { companyCountryIssue, normalizeCountry } from "../src/country";
import { companyInMarket } from "../src/gtm-market";

describe("country normalization", () => {
	it("saves names and codes with the same market identity", () => {
		expect(normalizeCountry("IN")).toEqual({ code: "IN", name: "India" });
		expect(normalizeCountry(" india ")).toEqual({ code: "IN", name: "India" });
		expect(normalizeCountry("US")).toEqual({
			code: "US",
			name: "United States",
		});
		expect(normalizeCountry("USA")).toEqual(normalizeCountry("US"));
		expect(normalizeCountry("unknown place")).toBeNull();
	});

	it("accepts old country codes while records are corrected", () => {
		expect(companyInMarket({ countryCode: null, country: "IN" }, "IN")).toBe(
			true,
		);
		expect(companyInMarket({ countryCode: null, country: "USA" }, "US")).toBe(
			true,
		);
	});

	it("identifies missing, invalid, and conflicting company countries", () => {
		expect(companyCountryIssue({ country: null, countryCode: null })).toContain(
			"missing",
		);
		expect(
			companyCountryIssue({ country: "Atlantis", countryCode: null }),
		).toContain("invalid");
		expect(
			companyCountryIssue({ country: "India", countryCode: "US" }),
		).toContain("disagree");
		expect(
			companyCountryIssue({ country: "IN", countryCode: null }),
		).toBeNull();
	});
});
