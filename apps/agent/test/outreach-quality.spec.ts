import { describe, expect, test } from "bun:test";
import { assertOutreachQuality } from "../agent/lib/outreach-quality";

describe("outreach quality", () => {
	test("rejects internal verification details in prospect email", () => {
		expect(() =>
			assertOutreachQuality({
				"Approval-ready email body":
					"I noted your SAFE verification (Reoon, 98/100).",
			}),
		).toThrow("Remove email verification vendors");
	});

	test("keeps verification details in internal research", () => {
		expect(() =>
			assertOutreachQuality({
				"Approval-ready email body":
					"Your ETCISO discussion covered earlier threat detection. Would a scoped red-team exercise help test that workflow?",
				"CRM facts": "Reoon SAFE verification: 98/100",
			}),
		).not.toThrow();
	});

	test("rejects verification as a public source", () => {
		expect(() =>
			assertOutreachQuality({
				"Approval-ready email body": "Would a call about SOC testing help?",
				Sources: "Reoon SAFE verification: 98/100",
			}),
		).toThrow("Email verification is an internal contact check");
	});
});
