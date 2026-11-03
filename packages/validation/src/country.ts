const displayNames = new Intl.DisplayNames(["en"], {
	type: "region",
	fallback: "none",
});

const excludedCodes = new Set([
	"AC",
	"CP",
	"DG",
	"EA",
	"EU",
	"EZ",
	"IC",
	"QO",
	"TA",
	"UN",
	"XA",
	"XB",
	"ZZ",
]);

const aliases: Record<string, string> = {
	usa: "US",
	"u.s.a.": "US",
	"united states of america": "US",
	uk: "GB",
	"u.k.": "GB",
	uae: "AE",
	"u.a.e.": "AE",
	"republic of india": "IN",
};

const names = new Map<string, { code: string; name: string }>();

for (let first = 65; first <= 90; first++) {
	for (let second = 65; second <= 90; second++) {
		const code = String.fromCharCode(first, second);
		const name = displayNames.of(code);
		if (!name || name === code || name === "Unknown Region") continue;
		if (excludedCodes.has(code)) continue;
		const country = { code, name };
		names.set(code.toLowerCase(), country);
		names.set(name.toLowerCase(), country);
	}
}

export function normalizeCountry(value: string | null | undefined) {
	const key = value?.trim().toLowerCase();
	if (!key) return null;
	return names.get(aliases[key]?.toLowerCase() ?? key) ?? null;
}
