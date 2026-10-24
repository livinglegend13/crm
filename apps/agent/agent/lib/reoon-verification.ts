import { db } from "@crm/db";
import { reoonResult } from "@crm/validation/reoon";
import { reoonKey } from "./reoon-key";
import { SALES_INTEGRATIONS } from "./sales-integrations-config";

export async function verifyContactEmail(contactId: string): Promise<string> {
	const key = await reoonKey();
	if (!key)
		return "Reoon is not configured. Email verification is unavailable.";
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: { email: true },
	});
	if (!contact?.email) return "Contact has no email address to verify.";
	const email = contact.email.trim().toLowerCase();
	const url = new URL("https://emailverifier.reoon.com/api/v1/verify");
	url.searchParams.set("email", email);
	url.searchParams.set("key", key);
	url.searchParams.set("mode", "power");
	const response = await fetch(url, {
		signal: AbortSignal.timeout(SALES_INTEGRATIONS.reoon.timeoutMs),
	});
	if (!response.ok)
		throw new Error(`Reoon verification failed with HTTP ${response.status}.`);
	const result = reoonResult.parse(await response.json());
	if (result.email.toLowerCase() !== email)
		throw new Error("Reoon returned another email address.");
	const safe = result.status.toLowerCase() === "safe" && result.is_safe_to_send;
	const current = await db.contact.findUnique({
		where: { id: contactId },
		select: { email: true },
	});
	if (current?.email?.trim().toLowerCase() !== email)
		return "Contact email changed during verification. Result discarded.";
	await db.emailVerification.upsert({
		where: { contactId },
		create: {
			contactId,
			email,
			status: result.status,
			score: result.overall_score ?? null,
			safe,
		},
		update: {
			email,
			status: result.status,
			score: result.overall_score ?? null,
			safe,
			checkedAt: new Date(),
		},
	});
	return `Reoon status: ${result.status}. Safe to send: ${safe}.`;
}
