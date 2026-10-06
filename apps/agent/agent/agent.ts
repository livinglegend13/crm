import "@crm/env/load";

import { onTelemetryProblem, syncVersion } from "@crm/telemetry";
import { defineAgent, defineDynamic } from "eve";
import { azureModelConfigured, fallbackModel } from "./lib/azure-model";
import { AZURE_MODEL } from "./lib/azure-model-config";
import { logCapabilities } from "./lib/capabilities";
import { selectedModel } from "./lib/model";

void logCapabilities();

onTelemetryProblem((message) => console.debug(`[telemetry] ${message}`));

void syncVersion();

const agent: ReturnType<typeof defineAgent> = defineAgent({
	model: defineDynamic({
		fallback: fallbackModel(),
		events: { "session.started": () => selectedModel() },
	}),
	...(azureModelConfigured()
		? { modelContextWindowTokens: AZURE_MODEL.contextWindowTokens }
		: {}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 50_000,
		sessionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
	},
});

export default agent;
