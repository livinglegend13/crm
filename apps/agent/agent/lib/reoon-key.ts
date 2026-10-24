import { readAzureSecret } from "@crm/env/azure-vault";

export async function reoonKey(): Promise<string | null> {
	const direct = process.env.REOON_API_KEY?.trim();
	if (direct) return direct;
	const vault = process.env.REOON_KEY_VAULT_NAME?.trim();
	return vault ? readAzureSecret(vault, "reoon-api-key") : null;
}
