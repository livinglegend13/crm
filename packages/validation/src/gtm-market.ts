const MARKET_TIME_ZONES: Record<string, string> = {
	IN: "Asia/Kolkata",
	AE: "Asia/Dubai",
	SA: "Asia/Riyadh",
	QA: "Asia/Qatar",
	BH: "Asia/Bahrain",
	OM: "Asia/Muscat",
	KW: "Asia/Kuwait",
	SG: "Asia/Singapore",
	US: "America/New_York",
	GB: "Europe/London",
};

export function marketTimeZone(countryCode: string) {
	return MARKET_TIME_ZONES[countryCode] ?? "UTC";
}

export function marketName(countryCode: string) {
	return (
		new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ??
		countryCode
	);
}

export function companyInMarket(
	company: { countryCode: string | null; country: string | null },
	countryCode: string,
) {
	return (
		company.countryCode?.toUpperCase() === countryCode ||
		company.country?.trim().toLowerCase() ===
			marketName(countryCode).toLowerCase()
	);
}
