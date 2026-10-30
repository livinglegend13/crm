import type { IncomingMessage } from "./thread-writer.service";

const failedAddressPatterns = [
	/was(?:n't| not) delivered to\s+<?([\w.+-]+@[\w.-]+\.[a-z]{2,})>?/i,
	/final-recipient:\s*rfc822;\s*<?([\w.+-]+@[\w.-]+\.[a-z]{2,})>?/i,
	/delivery has failed to these recipients or groups:\s*<?([\w.+-]+@[\w.-]+\.[a-z]{2,})>?/i,
];

export function failedRecipient(message: IncomingMessage): string | null {
	if (!/^(mailer-daemon|postmaster)([+@-]|$)/i.test(message.from.email))
		return null;
	for (const pattern of failedAddressPatterns) {
		const match = message.body.match(pattern);
		if (match?.[1]) return match[1].toLowerCase();
	}
	return null;
}
