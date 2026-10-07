import { describe, expect, test } from "bun:test";
import {
	campaignWindowOpen,
	nextCampaignAgent,
} from "../agent/lib/campaign-automation-policy";

describe("campaign automation", () => {
	const schedule = {
		sendDays: [1, 2, 3, 4, 5],
		startMinute: 540,
		endMinute: 1020,
	};

	test("uses the India work window", () => {
		expect(campaignWindowOpen(schedule, new Date("2026-10-07T03:29:00Z"))).toBe(
			false,
		);
		expect(campaignWindowOpen(schedule, new Date("2026-10-07T03:30:00Z"))).toBe(
			true,
		);
		expect(campaignWindowOpen(schedule, new Date("2026-10-07T11:30:00Z"))).toBe(
			false,
		);
		expect(campaignWindowOpen(schedule, new Date("2026-10-10T05:00:00Z"))).toBe(
			false,
		);
	});

	test("queues research before a draft and leaves failed runs for review", () => {
		expect(nextCampaignAgent(undefined, false, false)).toBe(
			"terraeagle-sales-company",
		);
		expect(nextCampaignAgent("QUEUED", false, true)).toBeNull();
		expect(nextCampaignAgent("FAILED", false, true)).toBeNull();
		expect(nextCampaignAgent("SUCCEEDED", false, false)).toBeNull();
		expect(nextCampaignAgent("SUCCEEDED", false, true)).toBe(
			"terraeagle-sales-outbound-strategist",
		);
		expect(nextCampaignAgent("SUCCEEDED", true, true)).toBeNull();
	});
});
