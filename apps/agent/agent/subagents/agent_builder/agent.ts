import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { azureModelConfigured, fallbackModel } from "../../lib/azure-model";
import { AZURE_MODEL } from "../../lib/azure-model-config";
import { selectedModel } from "../../lib/model";

const agent: ReturnType<typeof defineAgent> = defineAgent({
	description:
		"Turn one private CRM builder-chat request into a validated, reviewable team-agent version without deploying it.",
	model: defineDynamic({
		fallback: fallbackModel(),
		events: { "session.started": () => selectedModel() },
	}),
	...(azureModelConfigured()
		? { modelContextWindowTokens: AZURE_MODEL.contextWindowTokens }
		: {}),
	outputSchema: z.object({
		status: z.literal("draft_ready"),
		summary: z.string().min(1).max(1000),
		agentId: z.string().min(1),
		versionId: z.string().min(1),
	}),
	limits: {
		maxInputTokensPerSession: 100_000,
		maxOutputTokensPerSession: 10_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});

export default agent;
