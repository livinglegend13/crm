import { safeFetch } from "@crm/db/safe-fetch";
import { RESEARCH } from "./research-config";

export type PublicPage = { url: string; html: string };

export async function readPublicPage(url: string): Promise<PublicPage | null> {
	const fetched = await safeFetch(url, {
		timeoutMs: RESEARCH.web.timeoutMs,
		httpsOnly: true,
	});
	if (!fetched) return null;
	const type = fetched.response.headers.get("content-type") ?? "";
	if (!fetched.response.ok || !type.includes("text/html")) {
		await fetched.response.body?.cancel();
		return null;
	}
	const reader = fetched.response.body?.getReader();
	if (!reader) return null;
	const decoder = new TextDecoder();
	let html = "";
	try {
		while (html.length < RESEARCH.brand.maxHtmlChars) {
			const chunk = await reader.read();
			if (chunk.done) break;
			html += decoder.decode(chunk.value, { stream: true });
		}
		html += decoder.decode();
	} finally {
		await reader.cancel();
	}
	return {
		url: fetched.url.href,
		html: html.slice(0, RESEARCH.brand.maxHtmlChars),
	};
}

export function visibleText(html: string, limit: number): string {
	return html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, limit);
}
