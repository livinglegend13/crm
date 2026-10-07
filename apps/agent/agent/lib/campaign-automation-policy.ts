const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

import { DISPATCH } from "./dispatch-config";

const INDIA_CLOCK = new Intl.DateTimeFormat("en-US", {
	timeZone: "Asia/Kolkata",
	weekday: "short",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

export function campaignWindowOpen(
	schedule: { sendDays: number[]; startMinute: number; endMinute: number },
	now: Date,
) {
	const parts = INDIA_CLOCK.formatToParts(now);
	const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
	const day = WEEKDAYS.indexOf(weekday) || 7;
	const minute =
		Number(parts.find((part) => part.type === "hour")?.value) * 60 +
		Number(parts.find((part) => part.type === "minute")?.value);
	return (
		schedule.sendDays.includes(day) &&
		minute >= schedule.startMinute &&
		minute < schedule.endMinute
	);
}

export function nextCampaignAgent(
	researchStatus: string | undefined,
	hasDraftRun: boolean,
	hasRecipient: boolean,
) {
	if (hasDraftRun) return null;
	if (!researchStatus) return "terraeagle-sales-company";
	if (researchStatus === "SUCCEEDED" && hasRecipient)
		return "terraeagle-sales-outbound-strategist";
	return null;
}

export function nextWorkflowStage(
	researchStatus: string | undefined,
	agentIds: string[],
	runs: Array<{ agentId: string; stageIndex: number; status: string }>,
) {
	if (researchStatus !== "SUCCEEDED") {
		return { complete: false, next: null };
	}
	for (const [stageIndex, agentId] of agentIds.entries()) {
		const run = runs.find(
			(entry) => entry.stageIndex === stageIndex && entry.agentId === agentId,
		);
		if (!run) return { complete: false, next: { agentId, stageIndex } };
		if (run.status !== "SUCCEEDED") return { complete: false, next: null };
	}
	return { complete: true, next: null };
}

export function followUpDue(
	previous: { sentAt: Date | null; status: string } | undefined,
	delayDays: number,
	now: Date,
	hasReply: boolean,
	hasRun: boolean,
) {
	return Boolean(
		previous?.status === "SENT" &&
			previous.sentAt &&
			previous.sentAt.getTime() + delayDays * DISPATCH.campaign.dayMs <=
				now.getTime() &&
			!hasReply &&
			!hasRun,
	);
}
