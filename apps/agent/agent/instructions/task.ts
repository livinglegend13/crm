import { defineDynamic, defineInstructions } from "eve/instructions";
import { z } from "zod";
import { focusOn, setBudget } from "../lib/focus";
import { sessionPreamble } from "../lib/preamble";
import { RESEARCH_INSTRUCTIONS } from "../lib/research-instructions";
import { attribute, purposeOf } from "../lib/session-purpose";

const attributeText = z.string().trim().min(1).nullable().catch(null);

const attributeNumber = z
	.union([z.string(), z.number()])
	.transform(Number)
	.refine(Number.isFinite)
	.nullable()
	.catch(null);

export default defineDynamic({
	events: {
		"session.started": async (_event, ctx) => {
			const purpose = purposeOf(ctx);
			if (purpose === "builder") {
				return builderInstructions(ctx);
			}

			if (purpose === "team-agent") {
				return defineInstructions({
					markdown: `This is one background run of a deployed team agent. Call agent_runner exactly once and pass the run id from your user message. Do not call research tools or perform work yourself. Relay the specialist's structured factual completion summary. Never claim an external action that the specialist did not log.`,
				});
			}

			const attributes = ctx.session.auth.current?.attributes ?? {};
			const budget = attributeNumber.parse(attributes.budget);
			const kind = attributeText.parse(attributes.taskKind);

			if (budget) setBudget(budget);

			const fieldKeys = attributeText.parse(attributes.fieldKeys);

			const { markdown, focus } = await sessionPreamble(
				{
					contactId: attributeText.parse(attributes.contactId),
					companyId: attributeText.parse(attributes.companyId),
					dealId: attributeText.parse(attributes.dealId),
				},
				{
					dispatched: Boolean(kind),
					kind,
					reason: attributeText.parse(attributes.reason),
					budget,
					fieldKeys: fieldKeys ? fieldKeys.split(",") : null,
				},
			);

			focusOn({ ...focus, sessionId: ctx.session.id, taskKind: kind });

			return defineInstructions({
				markdown: `${RESEARCH_INSTRUCTIONS}\n\n${markdown}`,
			});
		},
		"turn.started": (_event, ctx) =>
			purposeOf(ctx) === "builder" ? builderInstructions(ctx) : null,
	},
});

function builderInstructions(ctx: Parameters<typeof purposeOf>[0]) {
	return defineInstructions({
		markdown: builderTaskMarkdown(
			attribute(ctx, "commandType"),
			attribute(ctx, "needsTitle") === "true",
		),
	});
}

export function builderTaskMarkdown(
	commandType: string | null,
	needsTitle = false,
): string {
	const task =
		commandType === "CREATE_AGENT"
			? `This private CRM chat turn is authorized to create or revise an agent. Call agent_builder exactly once and call it immediately; do not ask the user a clarification yourself. Pass the complete request, the conversation's relevant decisions, every tagged resource, and your understanding of any attachment. Do not call research tools or mutate CRM records yourself. The specialist inspects authoritative context, asks any essential clarification directly through ask_question, and returns only when the draft is ready. Never retry agent_builder in the same turn. If the specialist fails, explain that the build could not finish and ask the user to try again instead of delegating again. If the specialist returns draft_ready, relay its concise summary and explain that the draft is ready for human review and is not deployed yet.`
			: `This is a private CRM assistant chat. When the user explicitly asks to run a tagged live team agent for a tagged company, contact, or deal, call run_team_agent once with that agent ID, record kind, record ID, and the user's focus. The tool queues a read-only scoped run. Give its run link and say that its output appears when complete. Never claim a queued run has completed. For other requests, answer directly in this turn. Never promise to check or report back later. Use tagged records as scope and use available read-only CRM tools when evidence is needed. Use list_email_follow_ups for unanswered prospect emails, reply ownership, and overdue replies. Continue its pages until the requested scope is complete. Use list_deals for pipeline-wide, open-deal, or inactivity questions and continue its pages until complete. The chat renders list_deals output as a structured deal list. Do not restate deal rows in prose. Give a concise synthesis, caveats, and useful next actions after tool results. Do not ask for a scope already clear from the request. If one necessary decision is missing, call ask_question once. Do not call agent_builder or mutate CRM records on this turn. Agent creation begins only from an explicit request to create or build one. Distinguish CRM evidence from inference and say when CRM lacks the answer.`;

	return needsTitle
		? `Before any other work, call set_chat_title once. Summarize the user's first message as a polished title of three to seven words in sentence case. Capture the intent, remove slash-command syntax and filler, and do not use quotation marks or ending punctuation.\n\n${task}`
		: task;
}
