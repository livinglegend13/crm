const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

import { DISPATCH } from "./dispatch-config";

const CLOCKS = new Map<string, Intl.DateTimeFormat>();

function marketClock(timeZone: string) {
	const existing = CLOCKS.get(timeZone);
	if (existing) return existing;
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});
	CLOCKS.set(timeZone, formatter);
	return formatter;
}

export function campaignWindowOpen(
	schedule: {
		sendDays: number[];
		startMinute: number;
		endMinute: number;
		timeZone?: string;
	},
	now: Date,
) {
	const parts = marketClock(schedule.timeZone ?? "Asia/Kolkata").formatToParts(
		now,
	);
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
