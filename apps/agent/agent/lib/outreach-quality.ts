import { z } from "zod";

const outreachEmail = z.object({
	"Approval-ready email subject": z.string().optional(),
	"Approval-ready email body": z.string().optional(),
});

const internalSignals = [
	/\breoon\b/i,
	/\b(?:safe|email)\s+verif(?:ied|ication)\b/i,
	/\bdeliverability\s+(?:score|check)\b/i,
	/\b(?:email|contact)\s+(?:quality|confidence)\s+score\b/i,
	/\b\d{1,3}\s*\/\s*100\b/,
];

export function assertOutreachQuality(value: unknown) {
	const parsed = outreachEmail.safeParse(value);
	if (!parsed.success) return;
	const email = [
		parsed.data["Approval-ready email subject"],
		parsed.data["Approval-ready email body"],
	]
		.filter(Boolean)
		.join("\n");
	if (internalSignals.some((pattern) => pattern.test(email))) {
		throw new Error(
			"Remove email verification vendors, scores, and other internal contact checks from the prospect email. Keep them in internal research only.",
		);
	}
}
