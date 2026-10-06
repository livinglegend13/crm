import { z } from "zod";

export function outreachSenders(): string[] {
	return [
		...new Set(
			(process.env.OUTREACH_SENDER_ADDRESSES ?? "")
				.split(",")
				.map((value) => value.trim().toLowerCase())
				.filter((value) => z.email().safeParse(value).success),
		),
	];
}

export function sharedOutlookSource(address: string): `outlook:${string}` {
	return `outlook:${address}`;
}

export function senderFromSource(source: string): string | null {
	if (!source.startsWith("outlook:")) return null;
	const address = source.slice("outlook:".length);
	return outreachSenders().includes(address) ? address : null;
}
