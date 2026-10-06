import { describe, expect, test } from "bun:test";
import { senderAvailability } from "../src/agent/outreach-rotation";

describe("outreach sender rotation", () => {
	test("balances domains and respects per-mailbox limits", () => {
		const now = new Date("2026-10-06T12:00:00.000Z");
		const selection = senderAvailability(
			[
				{ address: "a@mailx.example.com", count: 10, lastStartedAt: null },
				{ address: "b@mailx.example.com", count: 1, lastStartedAt: null },
				{ address: "c@maily.example.com", count: 0, lastStartedAt: null },
			],
			now,
		);
		expect(selection.recommended).toBe("c@maily.example.com");
		expect(selection.available.has("a@mailx.example.com")).toBe(false);
	});

	test("blocks a sender inside the spacing window", () => {
		const now = new Date("2026-10-06T12:00:00.000Z");
		const selection = senderAvailability(
			[
				{
					address: "a@mailx.example.com",
					count: 1,
					lastStartedAt: new Date("2026-10-06T11:46:00.000Z"),
				},
			],
			now,
		);
		expect(selection.recommended).toBeNull();
	});
});
