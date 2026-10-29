const SENDER_NAMES = {
	"anika.sinha@mailx.terraeagle.com": "Anika Sinha",
	"meera.rao@mailx.terraeagle.com": "Meera Rao",
	"kavya.nair@mailx.terraeagle.com": "Kavya Nair",
	"neha.kapoor@mailx.terraeagle.com": "Neha Kapoor",
	"riya.menon@mailx.terraeagle.com": "Riya Menon",
	"aisha.khan@maily.terraeagle.com": "Aisha Khan",
	"tara.mehta@maily.terraeagle.com": "Tara Mehta",
	"diya.iyer@maily.terraeagle.com": "Diya Iyer",
	"sara.desai@maily.terraeagle.com": "Sara Desai",
	"priya.shah@maily.terraeagle.com": "Priya Shah",
} as const;

export function outreachSenderName(address: string | null | undefined) {
	if (!address) return null;
	return (
		SENDER_NAMES[address.toLowerCase() as keyof typeof SENDER_NAMES] ?? null
	);
}

export function withOutreachSignature(
	body: string,
	address: string | null | undefined,
) {
	const name = outreachSenderName(address);
	if (!name) return body;
	const text = body.replaceAll("\r\n", "\n").trimEnd();
	const withoutCompanySignature = text.replace(
		/\n{2,}(?:(?:best regards|kind regards|regards|best|thanks|sincerely)[,.]?\s*\n)?[^\n]{2,80}\nTerraeagle\s*$/i,
		"",
	);
	const withoutShortSignature = withoutCompanySignature.replace(
		/\n{2,}[—–-]\s*[^\n]{2,80}\s*$/u,
		"",
	);
	const withoutNameSignature = withoutShortSignature.replace(
		/\n{2,}(?:best regards|kind regards|regards|best|thanks|sincerely)[,.]?\s*\n[^\n]{2,80}\s*$/i,
		"",
	);
	return `${withoutNameSignature.trimEnd()}\n\nRegards,\n${name}\nTerraeagle`;
}

export function hasOutreachSignature(
	body: string,
	address: string | null | undefined,
) {
	const name = outreachSenderName(address);
	return (
		!name ||
		body
			.replaceAll("\r\n", "\n")
			.trimEnd()
			.endsWith(`Regards,\n${name}\nTerraeagle`)
	);
}

export function withPersonalSignature(body: string, signature: string): string {
	const normalized = body.replaceAll("\r\n", "\n").trimEnd();
	const ending = signature.trim();
	if (!ending || normalized.endsWith(ending)) return normalized;
	const withoutCompany = normalized.replace(
		/\n{2,}(?:(?:best regards|kind regards|regards|best|thanks|sincerely)[,.]?\s*\n)?[^\n]{2,80}\nTerraeagle\s*$/i,
		"",
	);
	const withoutShort = withoutCompany.replace(
		/\n{2,}[—–-]\s*[^\n]{2,80}\s*$/u,
		"",
	);
	return `${withoutShort.trimEnd()}\n\n${ending}`;
}
