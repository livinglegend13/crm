import { db } from "@crm/db";
import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";
import { defineAgent, defineDynamic } from "eve";
import { z } from "zod";
import { azureModelConfigured, fallbackModel } from "../../lib/azure-model";
import { AZURE_MODEL } from "../../lib/azure-model-config";
import { attribute, purposeOf } from "../../lib/session-purpose";

const agent: ReturnType<typeof defineAgent> = defineAgent({
	description:
		"Execute one immutable deployed CRM agent version and persist its result and every side effect.",
	model: defineDynamic({
		fallback: fallbackModel(),
		events: {
			"session.started": async (_event, ctx) => {
				if (purposeOf(ctx) !== "team-agent") return null;
				const runId = attribute(ctx, "runId");
				if (!runId) return null;

				const run = await db.agentRun.findUnique({
					where: { id: runId },
					select: {
						version: {
							select: { modelId: true, modelContextWindowTokens: true },
						},
					},
				});
				if (
					azureModelConfigured() &&
					run?.version.modelId === DEFAULT_AGENT_MODEL.id
				) {
					return null;
				}

				return run
					? {
							model: run.version.modelId,
							modelContextWindowTokens: run.version.modelContextWindowTokens,
						}
					: null;
			},
		},
	}),
	...(azureModelConfigured()
		? { modelContextWindowTokens: AZURE_MODEL.contextWindowTokens }
		: {}),
	outputSchema: z.object({
		summary: z.string().min(1).max(1000),
		result: z.record(z.string(), z.unknown()).nullable(),
	}),
	limits: {
		maxInputTokensPerSession: 500_000,
		maxOutputTokensPerSession: 40_000,
		sessionTimeoutMs: 24 * 60 * 60 * 1000,
	},
});

export default agent;
