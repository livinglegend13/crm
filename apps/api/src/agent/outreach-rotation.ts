import { OUTREACH_ROTATION } from "./outreach-rotation.config";

export type SenderUse = {
	address: string;
	count: number;
	lastStartedAt: Date | null;
};

export function senderAvailability(rows: SenderUse[], now: Date) {
	const domainCounts = new Map<string, number>();
	for (const row of rows) {
		const domain = row.address.split("@")[1] ?? "";
		domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + row.count);
	}
	const available = rows.filter(
		(row) =>
			row.count < OUTREACH_ROTATION.maxPerMailboxPerDay &&
			(!row.lastStartedAt ||
				now.getTime() - row.lastStartedAt.getTime() >=
					OUTREACH_ROTATION.minimumGapMs),
	);
	available.sort((first, second) => {
		const firstDomain = first.address.split("@")[1] ?? "";
		const secondDomain = second.address.split("@")[1] ?? "";
		return (
			(domainCounts.get(firstDomain) ?? 0) -
				(domainCounts.get(secondDomain) ?? 0) ||
			first.count - second.count ||
			(first.lastStartedAt?.getTime() ?? 0) -
				(second.lastStartedAt?.getTime() ?? 0) ||
			first.address.localeCompare(second.address)
		);
	});
	return {
		recommended: available[0]?.address ?? null,
		available: new Set(available.map((row) => row.address)),
	};
}
