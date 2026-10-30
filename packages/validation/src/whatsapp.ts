import { z } from "zod";

export const whatsappInitiationInput = z.object({
	contactId: z.string().min(1),
	message: z.string().trim().min(1).max(2000),
});

export function whatsappNumber(
	phone: string | null,
	countryCode: string | null,
) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, "");
	if (phone.trim().startsWith("+"))
		return digits.length >= 10 && digits.length <= 15 ? digits : null;
	if (countryCode?.toUpperCase() === "IN" && digits.length === 10)
		return `91${digits}`;
	return digits.length > 10 && digits.length <= 15 ? digits : null;
}
