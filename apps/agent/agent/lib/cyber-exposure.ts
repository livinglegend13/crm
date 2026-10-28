import { createHash } from "node:crypto";
import { safeFetch } from "@crm/db/safe-fetch";
import { z } from "zod";
import { CYBER_EXPOSURE } from "./cyber-exposure-config";

const hudsonSummary = z.object({
	employees: z
		.union([z.number().int().nonnegative(), z.array(z.unknown())])
		.optional(),
	users: z
		.union([z.number().int().nonnegative(), z.array(z.unknown())])
		.optional(),
	compromised_employees: z.number().int().nonnegative().optional(),
	compromised_users: z.number().int().nonnegative().optional(),
});

const xposedResult = z.union([
	z.object({
		breaches: z.array(z.array(z.string())),
		status: z.literal("success"),
	}),
	z.object({ Error: z.literal("Not found") }),
]);

const leakCheckResult = z.object({
	success: z.boolean(),
	found: z.number().int().nonnegative(),
	sources: z.array(
		z.object({
			name: z.string(),
			date: z.string().regex(/^(?:\d{4}-\d{2})?$/),
		}),
	),
});

const providerQueue = {
	xposed: Promise.resolve(),
	leakCheck: Promise.resolve(),
};
const providerNextAt = { xposed: 0, leakCheck: 0 };

async function rateLimited<T>(
	provider: "xposed" | "leakCheck",
	gapMs: number,
	request: () => Promise<T>,
): Promise<T> {
	const queued = providerQueue[provider].then(async () => {
		const delay = Math.max(0, providerNextAt[provider] - Date.now());
		if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
		providerNextAt[provider] = Date.now() + gapMs;
		return request();
	});
	providerQueue[provider] = queued.then(
		() => undefined,
		() => undefined,
	);
	return queued;
}

type Check = {
	source: "Hudson Rock" | "XposedOrNot" | "LeakCheck";
	status: "detected" | "not_found" | "unavailable";
	count: number | null;
	latestRecord: string | null;
};

const SOURCES = ["Hudson Rock", "XposedOrNot", "LeakCheck"] as const;

export type CyberExposure = {
	domain: string;
	checkedAt: string;
	contactsChecked: number;
	signal: "multiple_sources" | "single_source" | "none_found" | "unknown";
	checks: Check[];
};

async function readJson(url: string): Promise<unknown | null> {
	try {
		const fetched = await safeFetch(url, {
			timeoutMs: CYBER_EXPOSURE.request.timeoutMs,
			httpsOnly: true,
		});
		if (!fetched || (fetched.response.status !== 404 && !fetched.response.ok)) {
			await fetched?.response.body?.cancel();
			return null;
		}
		const type = fetched.response.headers.get("content-type") ?? "";
		if (!type.includes("application/json")) {
			await fetched.response.body?.cancel();
			return null;
		}
		const reader = fetched.response.body?.getReader();
		if (!reader) return null;
		const decoder = new TextDecoder();
		let bytes = 0;
		let body = "";
		try {
			while (bytes < CYBER_EXPOSURE.request.maxBytes) {
				const chunk = await reader.read();
				if (chunk.done) break;
				const part = chunk.value.subarray(
					0,
					CYBER_EXPOSURE.request.maxBytes - bytes,
				);
				body += decoder.decode(part, { stream: true });
				bytes += part.byteLength;
				if (part.byteLength < chunk.value.byteLength) return null;
			}
			body += decoder.decode();
		} finally {
			await reader.cancel();
		}
		return JSON.parse(body) as unknown;
	} catch {
		return null;
	}
}

function count(value: number | unknown[] | undefined): number | null {
	return Array.isArray(value) ? value.length : (value ?? null);
}

async function hudson(domain: string): Promise<Check> {
	const url = new URL(
		"https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain",
	);
	url.searchParams.set("domain", domain);
	const response = hudsonSummary.safeParse(await readJson(url.href));
	const data = response.success ? response.data : null;
	const employees = count(data?.employees) ?? data?.compromised_employees;
	const users = count(data?.users) ?? data?.compromised_users;
	const total =
		employees === undefined || employees === null
			? (users ?? null)
			: employees + (users ?? 0);
	return {
		source: "Hudson Rock",
		status:
			total === null ? "unavailable" : total > 0 ? "detected" : "not_found",
		count: total,
		latestRecord: null,
	};
}

async function xposed(email: string): Promise<Check> {
	const url = `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`;
	const response = xposedResult.safeParse(await readJson(url));
	if (!response.success)
		return {
			source: "XposedOrNot",
			status: "unavailable",
			count: null,
			latestRecord: null,
		};
	const names =
		"breaches" in response.data ? response.data.breaches.flat() : [];
	return {
		source: "XposedOrNot",
		status: names.length ? "detected" : "not_found",
		count: names.length,
		latestRecord: null,
	};
}

async function leakCheck(email: string): Promise<Check> {
	const hash = createHash("sha256")
		.update(email.toLowerCase())
		.digest("hex")
		.slice(0, 24);
	const url = new URL("https://leakcheck.io/api/public");
	url.searchParams.set("check", hash);
	const response = leakCheckResult.safeParse(await readJson(url.href));
	if (!response.success || !response.data.success)
		return {
			source: "LeakCheck",
			status: "unavailable",
			count: null,
			latestRecord: null,
		};
	const dates = response.data.sources.map((source) => source.date).sort();
	return {
		source: "LeakCheck",
		status: response.data.found ? "detected" : "not_found",
		count: response.data.found,
		latestRecord: dates.at(-1) ?? null,
	};
}

export async function checkCyberExposure(
	domain: string,
	contactEmails: string[],
): Promise<CyberExposure> {
	const emails = [
		...new Set(contactEmails.map((email) => email.trim().toLowerCase())),
	]
		.filter(
			(email) =>
				email.endsWith(`@${domain}`) && z.email().safeParse(email).success,
		)
		.slice(0, CYBER_EXPOSURE.contacts.maxPerCompany);
	const checks: Check[] = [await hudson(domain)];
	for (const email of emails) {
		checks.push(
			await rateLimited("xposed", CYBER_EXPOSURE.rate.xposedGapMs, () =>
				xposed(email),
			),
		);
		checks.push(
			await rateLimited("leakCheck", CYBER_EXPOSURE.rate.leakCheckGapMs, () =>
				leakCheck(email),
			),
		);
	}
	const combined = SOURCES.map((source): Check => {
		const results = checks.filter((check) => check.source === source);
		const known = results.filter((check) => check.status !== "unavailable");
		const dates = known
			.flatMap((check) => (check.latestRecord ? [check.latestRecord] : []))
			.sort();
		return {
			source,
			status: known.some((check) => check.status === "detected")
				? "detected"
				: known.length
					? "not_found"
					: "unavailable",
			count: known.length
				? known.reduce((total, check) => total + (check.count ?? 0), 0)
				: null,
			latestRecord: dates.at(-1) ?? null,
		};
	});
	const positive = new Set(
		combined
			.filter((item) => item.status === "detected")
			.map((item) => item.source),
	);
	const checked = combined.filter((item) => item.status !== "unavailable");
	return {
		domain,
		checkedAt: new Date().toISOString(),
		contactsChecked: emails.length,
		signal:
			positive.size >= 2
				? "multiple_sources"
				: positive.size === 1
					? "single_source"
					: checked.length
						? "none_found"
						: "unknown",
		checks: combined,
	};
}

export function cyberExposureText(result: CyberExposure): string {
	const labels = {
		multiple_sources: "Exposure signals appeared in multiple public sources.",
		single_source: "An exposure signal appeared in one public source.",
		none_found:
			"No matching signal appeared in the checked sources. Coverage remains incomplete.",
		unknown: "Public sources did not return usable results.",
	};
	const lines = [
		`Cyber exposure check for ${result.domain}. ${labels[result.signal]}`,
		`Checked ${result.checkedAt}.`,
		`Checked ${result.contactsChecked} known company work addresses. This is not a breach probability or proof of a company breach.`,
		...result.checks.map(
			(check) =>
				`${check.source}: ${check.status.replace("_", " ")}${check.count === null ? "" : ` (${check.count} records)`}${check.latestRecord ? `; latest listed source ${check.latestRecord}` : ""}.`,
		),
		"Review the source records and dates before any customer claim. Do not include contact-level findings in outreach.",
		"Sources: https://www.hudsonrock.com/free-tools/ ; https://xposedornot.com/api_doc ; https://leakcheck.io/data-breach-api . Powered by LeakCheck: https://leakcheck.io/ .",
	];
	return lines.join("\n\n");
}
