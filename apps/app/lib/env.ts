export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const APP_URL =
	process.env.APP_URL?.split(",")[0]?.trim() || "http://localhost:3000";

export function isMarketing(): boolean {
	return process.env.IS_MARKETING === "true";
}
