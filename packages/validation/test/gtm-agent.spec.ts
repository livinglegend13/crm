import { describe, expect, it } from "bun:test";
import { campaignAgentRunInput, runCampaignAgentInput } from "../src/gtm";
import { recipientFromRunInput } from "../src/outreach-draft";

const campaignInput = {
	kind: "campaign-target",
	campaignId: "campaign-1",
	campaignTargetId: "target-1",
	companyId: "company-1",
	focus: "Tata Digital",
	contactName: "Uttam Kumar",
	recipientEmail: "uttam.kumar@tatadigital.com",
	campaignName: "India Filo",
	campaignBrief: "Storage qualification",
	steps: [
		{
			position: 0,
			delayDays: 0,
			subjectPrompt: "Storage costs",
			bodyPrompt: "Ask for the storage owner",
		},
	],
} as const;

describe("campaign agent runs", () => {
	it("keeps the verified recipient with the draft", () => {
		const parsed = campaignAgentRunInput.parse(campaignInput);
		expect(recipientFromRunInput(parsed)).toBe("uttam.kumar@tatadigital.com");
	});

	it("rejects an unsupported agent", () => {
		expect(
			runCampaignAgentInput.safeParse({
				id: "campaign-1",
				targetId: "target-1",
				agentId: "unapproved-agent",
				clientRequestId: "3751e3d4-e17a-4df5-9c53-56f07a78b4e7",
			}).success,
		).toBe(false);
	});

	it("rejects an invalid recipient", () => {
		expect(
			campaignAgentRunInput.safeParse({
				...campaignInput,
				recipientEmail: "not-an-email",
			}).success,
		).toBe(false);
	});
});
