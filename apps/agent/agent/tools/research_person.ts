import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";
import { spend } from "../lib/focus";
import { ask } from "../lib/perplexity";

export default defineDynamic({
	events: {
		"session.started": () =>
			process.env.PERPLEXITY_API_KEY?.trim()
				? defineTool({
						description:
							"Search the open web through Perplexity for cited sales context. Use CRM history first. Treat public person mentions as unverified.",
						inputSchema: z.object({
							question: z.string().describe("A specific research question."),
							deep: z.boolean().default(false),
						}),
						async execute({ question, deep }) {
							const charge = spend(deep ? 2 : 1);
							if (!charge.ok)
								return { ok: false as const, reason: charge.reason };
							const answer = await ask(question, {
								model: deep ? "sonar-pro" : "sonar",
								system:
									"You are researching for a B2B sales rep. Be specific and factual. State only what your sources support, prefer recent information, and say plainly when you do not know. Never speculate about a person.",
							});
							if (!answer.ok)
								return { ok: false as const, reason: answer.reason };
							return {
								ok: true as const,
								answer: answer.data.text,
								citations: answer.data.citations,
								note: "Only write claims that have a citation.",
							};
						},
					})
				: null,
	},
});
