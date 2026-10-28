import type { Brand, LookupResult } from "./context-dev";
import { readPublicPage } from "./public-page";
import { RESEARCH } from "./research-config";

function attributes(tag: string): Map<string, string> {
	const values = new Map<string, string>();
	for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
		values.set((match[1] ?? "").toLowerCase(), match[3] ?? "");
	}
	return values;
}

function decode(value: string): string {
	return value
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function siteUrl(raw: string | undefined, base: URL): string | null {
	if (!raw) return null;
	try {
		const url = new URL(decode(raw), base);
		return url.protocol === "https:" && url.hostname === base.hostname
			? url.href
			: null;
	} catch {
		return null;
	}
}

export function publicBrandFromHtml(
	html: string,
	pageUrl: string,
): Brand | null {
	const base = new URL(pageUrl);
	const meta = new Map<string, string>();
	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const attr = attributes(tag);
		const key = attr.get("property") ?? attr.get("name");
		const value = attr.get("content");
		if (key && value) meta.set(key.toLowerCase(), decode(value));
	}
	const links = new Map<string, string>();
	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		const attr = attributes(tag);
		const rel = attr.get("rel")?.toLowerCase();
		const href = siteUrl(attr.get("href"), base);
		if (rel && href) links.set(rel, href);
	}
	const title =
		meta.get("og:site_name") ??
		decode(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim();
	const description = (
		meta.get("description") ??
		meta.get("og:description") ??
		""
	)
		.trim()
		.slice(0, RESEARCH.brand.maxDescriptionChars);
	const logoTag = (html.match(/<img\b[^>]*>/gi) ?? []).find((tag) =>
		/(?:^|\s)brand-logo(?:\s|$)/i.test(attributes(tag).get("class") ?? ""),
	);
	const logo = logoTag ? siteUrl(attributes(logoTag).get("src"), base) : null;
	const icon = links.get("icon") ?? links.get("shortcut icon") ?? null;
	if (!title && !description && !logo && !icon) return null;
	return {
		domain: base.hostname,
		title: title || null,
		description: description || null,
		logos: [
			...(logo ? [{ url: logo, type: "logo", mode: "light" }] : []),
			...(icon ? [{ url: icon, type: "icon", mode: "light" }] : []),
		],
	};
}

export async function publicBrandByDomain(
	domain: string,
): Promise<LookupResult> {
	let url: URL;
	try {
		url = new URL(`https://${domain}`);
	} catch {
		return { outcome: "skipped", reason: "Invalid company domain." };
	}
	if (url.hostname !== domain.toLowerCase() || url.port || url.username) {
		return { outcome: "skipped", reason: "Invalid company domain." };
	}
	const page = await readPublicPage(url.href);
	if (!page)
		return {
			outcome: "skipped",
			reason: "Public company site could not be read.",
		};
	const resolvedHost = new URL(page.url).hostname.toLowerCase();
	if (resolvedHost !== url.hostname && resolvedHost !== `www.${url.hostname}`) {
		return {
			outcome: "skipped",
			reason: "Company site redirects to another domain.",
		};
	}
	const brand = publicBrandFromHtml(page.html, page.url);
	return brand
		? {
				outcome: "found",
				brand,
				raw: { source: "public-homepage", url: page.url, brand },
			}
		: {
				outcome: "skipped",
				reason: "No public brand metadata appeared on the homepage.",
			};
}
