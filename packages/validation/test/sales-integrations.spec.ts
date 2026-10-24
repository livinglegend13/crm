import { describe, expect, test } from "bun:test";
import { closelyWebhook } from "../src/closely";
import { reoonResult } from "../src/reoon";

describe("sales integration boundaries", () => {
	test("accepts the published Closely contact event shape", () => {
		const event = closelyWebhook.parse({
			trigger: "User accepted the connection",
			firstName: "John",
			lastName: "Doe",
			workEmail: "john@example.com",
			linkedinUrl: "https://www.linkedin.com/in/john-doe/",
			accountDto: {
				email: "rep@terraeagle.com",
				campaignsName: ["Filo India"],
			},
			companyDto: { name: "Example", websiteUrl: "https://example.com" },
		});
		expect(event.trigger).toBe("User accepted the connection");
		expect(event.accountDto?.campaignsName).toEqual(["Filo India"]);
	});

	test("rejects a Closely event without a trigger", () => {
		expect(closelyWebhook.safeParse({ firstName: "John" }).success).toBe(false);
	});

	test("parses a Reoon power-mode result", () => {
		const result = reoonResult.parse({
			email: "john@example.com",
			status: "safe",
			overall_score: 98,
			is_safe_to_send: true,
		});
		expect(result.is_safe_to_send).toBe(true);
	});
});
