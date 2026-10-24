import { z } from "zod";

const identityToken = z.object({ access_token: z.string().min(1) });
const vaultSecret = z.object({ value: z.string().min(1) });
const cache = new Map<string, { value: string; expiresAt: number }>();

const VAULT = {
	timeoutMs: 5_000,
	cacheMs: 5 * 60_000,
} as const;

export async function readAzureSecret(
	vault: string,
	secret: string,
): Promise<string | null> {
	if (
		!/^[a-zA-Z0-9-]{3,24}$/.test(vault) ||
		!/^[a-zA-Z0-9-]{1,127}$/.test(secret)
	)
		return null;
	const key = `${vault}/${secret}`;
	const cached = cache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.value;
	try {
		const metadata = new URL(
			"http://169.254.169.254/metadata/identity/oauth2/token",
		);
		metadata.searchParams.set("api-version", "2018-02-01");
		metadata.searchParams.set("resource", "https://vault.azure.net");
		const tokenResponse = await fetch(metadata, {
			headers: { Metadata: "true" },
			signal: AbortSignal.timeout(VAULT.timeoutMs),
		});
		if (!tokenResponse.ok) return null;
		const token = identityToken.parse(await tokenResponse.json()).access_token;
		const response = await fetch(
			`https://${vault}.vault.azure.net/secrets/${secret}?api-version=7.4`,
			{
				headers: { Authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(VAULT.timeoutMs),
			},
		);
		if (!response.ok) return null;
		const value = vaultSecret.parse(await response.json()).value;
		cache.set(key, { value, expiresAt: Date.now() + VAULT.cacheMs });
		return value;
	} catch {
		return null;
	}
}
