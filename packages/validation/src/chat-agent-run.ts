import { z } from "zod";

export const chatAgentRunInput = z.object({
	mode: z.literal("CHAT_READ_ONLY"),
	focus: z.string().trim().min(1).max(2000),
	conversationId: z.string().min(1),
	submissionId: z.string().min(1),
	record: z.object({
		kind: z.enum(["company", "contact", "deal"]),
		id: z.string().min(1),
		label: z.string().min(1),
	}),
});

export type ChatAgentRunInput = z.infer<typeof chatAgentRunInput>;
