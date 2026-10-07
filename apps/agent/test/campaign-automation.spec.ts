import { describe, expect, test } from "bun:test";
import {
	campaignWindowOpen,
	followUpDue,
	nextCampaignAgent,
	nextWorkflowStage,
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

	test("waits for a sent draft and stops follow-ups after a reply", () => {
		const now = new Date("2026-10-07T09:00:00Z");
		const sent = { status: "SENT", sentAt: new Date("2026-10-03T09:00:00Z") };
		expect(followUpDue(sent, 4, now, false, false)).toBe(true);
		expect(followUpDue(sent, 5, now, false, false)).toBe(false);
		expect(followUpDue(sent, 4, now, true, false)).toBe(false);
		expect(followUpDue(sent, 4, now, false, true)).toBe(false);
		expect(
			followUpDue({ ...sent, status: "APPROVED" }, 4, now, false, false),
		).toBe(false);
	});

	test("runs advisory agents in order and stops after a failed stage", () => {
		const agents = ["contact", "discovery"];
		expect(nextWorkflowStage(undefined, agents, []).next).toBeNull();
		expect(nextWorkflowStage("SUCCEEDED", agents, []).next).toEqual({
			agentId: "contact",
			stageIndex: 0,
		});
		expect(
			nextWorkflowStage("SUCCEEDED", agents, [
				{ agentId: "contact", stageIndex: 0, status: "FAILED" },
			]).next,
		).toBeNull();
		expect(
			nextWorkflowStage("SUCCEEDED", agents, [
				{ agentId: "contact", stageIndex: 0, status: "SUCCEEDED" },
			]).next,
		).toEqual({ agentId: "discovery", stageIndex: 1 });
		expect(
			nextWorkflowStage("SUCCEEDED", agents, [
				{ agentId: "contact", stageIndex: 0, status: "SUCCEEDED" },
				{ agentId: "discovery", stageIndex: 1, status: "SUCCEEDED" },
			]).complete,
		).toBe(true);
	});
});
