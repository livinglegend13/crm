const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
