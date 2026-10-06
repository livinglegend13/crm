import { z } from "zod";

export const agentRunResult = z.record(z.string(), z.json());

export type AgentRunResult = z.infer<typeof agentRunResult>;
