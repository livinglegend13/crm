import { z } from "zod";

const recipientsSchema = z.array(
	z.object({
		email: z.email(),
		name: z.string().nullable(),
		kind: z.enum(["to", "cc"]),
	}),
);

export function messageMailboxes(
	message: { direction: string; fromEmail: string; recipients: unknown },
	knownAddresses: ReadonlySet<string>,
): string[] {
	const addresses =
		message.direction === "OUTBOUND"
			? [message.fromEmail]
			: recipientsSchema
					.parse(message.recipients)
					.map((recipient) => recipient.email);
	return [...new Set(addresses.map((address) => address.toLowerCase()))]
		.filter((address) => knownAddresses.has(address))
		.sort();
}
