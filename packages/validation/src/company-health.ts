import { z } from "zod";
import { companyCountryIssue } from "./country";

export function validCompanyEmail(value: string) {
	return z.email().safeParse(value).success;
}

export function validCompanyWebsite(value: string) {
	try {
		const url = new URL(value);
		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			url.hostname.includes(".")
		);
	} catch {
		return false;
	}
}

export function companyRecordIssues(company: {
	country: string | null;
	countryCode: string | null;
	email: string | null;
	website: string | null;
}) {
	const issues: { field: "country" | "email" | "website"; message: string }[] =
		[];
	const country = companyCountryIssue(company);
	if (country) issues.push({ field: "country", message: country });
	if (company.email && !validCompanyEmail(company.email)) {
		issues.push({ field: "email", message: "Email address is invalid." });
	}
	if (company.website && !validCompanyWebsite(company.website)) {
		issues.push({ field: "website", message: "Website URL is invalid." });
	}
	return issues;
}
