import { createAzure } from "@ai-sdk/azure";
import { ManagedIdentityCredential } from "@azure/identity";
import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { AZURE_MODEL } from "./azure-model-config";

export function azureModelConfigured(): boolean {
	return Boolean(
		process.env.AZURE_RESOURCE_NAME?.trim() &&
			process.env.AZURE_MODEL_DEPLOYMENT?.trim(),
	);
}

export function fallbackModel():
	| string
	| ReturnType<ReturnType<typeof createAzure>> {
	const resourceName = process.env.AZURE_RESOURCE_NAME?.trim();
	const deployment = process.env.AZURE_MODEL_DEPLOYMENT?.trim();

	if (!resourceName || !deployment) return DEFAULT_AGENT_MODEL.id;

	const credential = new ManagedIdentityCredential();
	const azure = createAzure({
		resourceName,
		apiKey: "managed-identity",
		fetch: async (input, init) => {
			const token = await credential.getToken(AZURE_MODEL.scope);
			const headers = new Headers(init?.headers);
			headers.delete("api-key");
			headers.set("authorization", `Bearer ${token.token}`);
			return fetch(input, { ...init, headers });
		},
	});

	return azure(deployment);
}
