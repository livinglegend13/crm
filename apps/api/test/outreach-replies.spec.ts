import { describe, expect, test } from "bun:test";

process.env.TEST_DATABASE_URL = "postgres://localhost/compai_unit_test";
const { OutreachRepliesService } = await import(
	"../src/microsoft/outreach-replies.service"
);

describe("outreach reply matching", () => {
	test("matches a reply to an accepted draft from the same mailbox", async () => {
		const drafts = [
			{
				id: "draft-1",
				userId: "user-1",
				subject: "Storage costs at Filo",
				user: { email: "owner@terraeagle.com" },
			},
		];
		const service = new OutreachRepliesService(
			{ outreachDraft: { findMany: async () => drafts } } as never,
			{} as never,
			{} as never,
		);
		const match = await service.match("rep@mailx.terraeagle.com", {
			rfcMessageId: "<reply-1@example.com>",
			rootId: "<first@example.com>",
			subject: "Re: Storage costs at Filo",
			from: { email: "buyer@example.com", name: null },
			recipients: [],
			body: "Thanks",
			sentAt: new Date("2026-10-07T10:00:00.000Z"),
		});
		expect(match?.id).toBe("draft-1");
	});

	test("ignores an unrelated subject", async () => {
		const service = new OutreachRepliesService(
			{
				outreachDraft: {
					findMany: async () => [{ id: "draft-1", subject: "Filo storage" }],
				},
			} as never,
			{} as never,
			{} as never,
		);
		const match = await service.match("rep@mailx.terraeagle.com", {
			rfcMessageId: "<reply-2@example.com>",
			rootId: "<first@example.com>",
			subject: "Other topic",
			from: { email: "buyer@example.com", name: null },
			recipients: [],
			body: "Hello",
			sentAt: new Date("2026-10-07T10:00:00.000Z"),
		});
		expect(match).toBeNull();
	});
});
