import { describe, expect, it } from "bun:test";
import { failedRecipient } from "../src/mailbox/delivery-failure.parse";
import type { IncomingMessage } from "../src/mailbox/thread-writer.service";

function message(from: string, body: string): IncomingMessage {
	return {
		rfcMessageId: "bounce",
		rootId: "bounce",
		subject: "Undeliverable",
		from: { email: from, name: null },
		recipients: [],
		body,
		sentAt: new Date(),
	};
}

describe("delivery failure recipient", () => {
	it("reads a Google address-not-found notice", () => {
		expect(
			failedRecipient(
				message(
					"mailer-daemon@googlemail.com",
					"Your message wasn't delivered to abhinaev@stratalink.org because the address couldn't be found.",
				),
			),
		).toBe("abhinaev@stratalink.org");
	});

	it("ignores an ordinary message quoting a failure", () => {
		expect(
			failedRecipient(
				message("person@example.com", "Message wasn't delivered to a@b.com"),
			),
		).toBeNull();
	});
});
