import { db } from "@crm/db";
import { parseAgentManifest } from "@crm/validation/agent-manifest";

const AGENTS = [
	[
		"Company Research",
		"sales-company",
		"Research a company's business, technology, storage footprint, and recent changes. Separate verified facts from hypotheses.",
	],
	[
		"Contact Research",
		"sales-contacts",
		"Find buying roles and contact context in CRM and public sources. Do not invent a person or contact detail.",
	],
	[
		"Opportunity Analyst",
		"sales-opportunity",
		"Assess a prospect's fit, urgency, buying signals, blockers, and next discovery questions.",
	],
	[
		"Competitive Analyst",
		"sales-competitive",
		"Compare documented alternatives and Terraeagle's position. Cite evidence and avoid unsupported claims.",
	],
	[
		"Sales Strategist",
		"sales-strategy",
		"Build a practical account plan with stakeholders, value hypotheses, risks, and next actions.",
	],
	[
		"Account Strategist",
		"sales-account-strategist",
		"Map an account's buying group, priorities, and expansion paths using documented CRM evidence.",
	],
	[
		"Sales Coach",
		"sales-coach",
		"Review outreach and deal activity. Recommend specific improvements for the sales representative.",
	],
	[
		"Deal Strategist",
		"sales-deal-strategist",
		"Identify decision criteria, deal risks, mutual actions, and a defensible close plan.",
	],
	[
		"Discovery Coach",
		"sales-discovery-coach",
		"Prepare discovery questions that validate business pain, technical fit, budget, and timing.",
	],
	[
		"Sales Engineer",
		"sales-engineer",
		"Prepare technical discovery and solution-fit questions. Distinguish product facts from requirements needing validation.",
	],
	[
		"Lead Generation Strategist",
		"sales-offer-lead-gen-strategist",
		"Define a narrow audience, a relevant offer, and an evidence-based lead generation experiment.",
	],
	[
		"Outbound Strategist",
		"sales-outbound-strategist",
		"Draft personalized outreach angles and a follow-up plan for human approval. Never send messages.",
	],
	[
		"Pipeline Analyst",
		"sales-pipeline-analyst",
		"Review CRM pipeline quality, stalled deals, missing fields, and next actions. Use actual CRM data.",
	],
	[
		"Proposal Strategist",
		"sales-proposal-strategist",
		"Outline a proposal from verified requirements, business value, assumptions, and open questions.",
	],
	[
		"Email Marketing Strategist",
		"marketing-email-strategist",
		"Plan consent-aware email segments, lifecycle messages, tests, and deliverability checks. Draft only.",
	],
] as const;

const SOURCES = {
	"ai-sales-team-claude":
		"https://github.com/zubair-trabzada/ai-sales-team-claude",
	"agency-agents": "https://github.com/msitarzewski/agency-agents",
};

const owner = await db.user.findFirst({
	where: { email: "aditya.ps@terraeagle.com" },
	select: { id: true },
});
if (!owner) throw new Error("Terraeagle owner account is unavailable.");

const model = await db.agentVersion.findFirst({
	where: { agent: { status: "LIVE" }, status: "DEPLOYED" },
	orderBy: { deployedAt: "desc" },
	select: { modelId: true, modelContextWindowTokens: true },
});
if (!model) throw new Error("No deployed agent model is available.");

for (const [name, slug, purpose] of AGENTS) {
	const id = `terraeagle-${slug}`;
	const existing = await db.agentDefinition.findUnique({
		where: { id },
		select: {
			id: true,
			currentVersion: {
				select: {
					id: true,
					number: true,
					instructions: true,
					manifest: true,
					modelId: true,
					modelContextWindowTokens: true,
					sandboxPolicy: true,
					validation: true,
				},
			},
		},
	});
	const source =
		slug.startsWith("sales-") &&
		[
			"sales-company",
			"sales-contacts",
			"sales-opportunity",
			"sales-competitive",
			"sales-strategy",
		].includes(slug)
			? SOURCES["ai-sales-team-claude"]
			: SOURCES["agency-agents"];
	const instructions = [
		`# ${name}`,
		"",
		purpose,
		"",
		"Work for Terraeagle's cybersecurity, AI, and FinOps sales team in India.",
		"Read inspect_run first. Use CRM and public HTTPS evidence through the approved tools.",
		"For manual runs, inspect_run.input.focus names the company, contact, or question. Research that focus first.",
		"For scheduled runs without a focus, query CRM for a relevant account and identify that account in the result.",
		"For Filo storage qualification, require evidence of at least 1 PB average stored capacity over 12 months.",
		"Mark capacity unknown when no reliable evidence establishes it. Do not infer capacity from company size.",
		"Use only the approved run.summary action. Do not write CRM records or send email.",
		"Return a useful result with Findings, Evidence, Unknowns, and Next actions.",
		"For outreach, include Approval-ready email subject and Approval-ready email body in the structured result.",
		"Call finish_run exactly once, even when evidence is unavailable.",
	].join("\n");
	if (existing) {
		const current = existing.currentVersion;
		if (
			current?.number === 1 &&
			!current.instructions.includes("inspect_run.input.focus")
		) {
			await db.$transaction(async (tx) => {
				const now = new Date();
				const version = await tx.agentVersion.create({
					data: {
						agentId: id,
						number: 2,
						status: "DEPLOYED",
						instructions,
						manifest: current.manifest as object,
						modelId: current.modelId,
						modelContextWindowTokens: current.modelContextWindowTokens,
						sandboxPolicy: current.sandboxPolicy as object,
						validation: current.validation as object,
						createdById: owner.id,
						approvedAt: now,
						deployedAt: now,
					},
					select: { id: true },
				});
				await tx.agentBuilderArtifact.createMany({
					data: [
						{
							versionId: version.id,
							path: "agent/instructions.md",
							language: "markdown",
							content: instructions,
							previousContent: current.instructions,
							revision: 1,
							status: "READY",
						},
						{
							versionId: version.id,
							path: "agent/manifest.json",
							language: "json",
							content: JSON.stringify(current.manifest, null, 2),
							revision: 1,
							status: "READY",
						},
						{
							versionId: version.id,
							path: "agent/README.md",
							language: "markdown",
							content: `# ${name}\n\n${purpose}\n\nAdapted from ${source}. Automatic runs start disabled.`,
							revision: 1,
							status: "READY",
						},
					],
				});
				await tx.agentDefinition.update({
					where: { id },
					data: { currentVersionId: version.id },
				});
				await tx.agentTrigger.updateMany({
					where: { agentId: id, versionId: current.id },
					data: { versionId: version.id },
				});
				await tx.agentAuditEvent.create({
					data: {
						agentId: id,
						versionId: version.id,
						actorUserId: owner.id,
						actorType: "USER",
						actorId: owner.id,
						type: "version.created",
						summary: "Added manual run focus to sales agent",
					},
				});
			});
			console.log(`Updated ${name}`);
		} else {
			console.log(`Kept ${name}`);
		}
		continue;
	}
	const manifest = parseAgentManifest({
		name,
		description: purpose,
		triggers: [
			{
				type: "MANUAL",
				name: "Manual run",
				summary: "A team member starts this agent",
				config: {},
			},
		],
		dataScope: {
			mode: "WORKSPACE",
			summary: "Read Terraeagle CRM records",
			resources: [],
		},
		actions: [
			{
				type: "run.summary",
				provider: "crm",
				summary: "Show research and drafts in the run result",
			},
		],
		access: ["CRM read", "Public web read", "Run summary"],
	});
	await db.$transaction(async (tx) => {
		await tx.agentDefinition.create({
			data: {
				id,
				name,
				description: purpose,
				status: "DRAFT",
				createdById: owner.id,
			},
		});
		const now = new Date();
		const version = await tx.agentVersion.create({
			data: {
				agentId: id,
				number: 1,
				status: "DEPLOYED",
				instructions,
				manifest,
				modelId: model.modelId,
				modelContextWindowTokens: model.modelContextWindowTokens,
				sandboxPolicy: {
					backend: "eve-default",
					networkPolicy: "deny-all",
					credentials: "app-runtime-only",
				},
				validation: {
					status: "passed",
					checkedAt: now.toISOString(),
					capabilities: ["run.summary"],
				},
				createdById: owner.id,
				approvedAt: now,
				deployedAt: now,
			},
			select: { id: true },
		});
		await tx.agentDefinition.update({
			where: { id },
			data: { status: "LIVE", currentVersionId: version.id },
		});
		await tx.agentTrigger.create({
			data: {
				agentId: id,
				versionId: version.id,
				type: "MANUAL",
				name: "Manual run",
				config: {},
				createdById: owner.id,
				enabled: true,
			},
		});
		await tx.agentBuilderArtifact.createMany({
			data: [
				{
					versionId: version.id,
					path: "agent/instructions.md",
					language: "markdown",
					content: instructions,
					revision: 1,
					status: "READY",
				},
				{
					versionId: version.id,
					path: "agent/manifest.json",
					language: "json",
					content: JSON.stringify(manifest, null, 2),
					revision: 1,
					status: "READY",
				},
				{
					versionId: version.id,
					path: "agent/README.md",
					language: "markdown",
					content: `# ${name}\n\n${purpose}\n\nAdapted from ${source}. Automatic runs start disabled.`,
					revision: 1,
					status: "READY",
				},
			],
		});
		await tx.agentAuditEvent.create({
			data: {
				agentId: id,
				versionId: version.id,
				actorUserId: owner.id,
				actorType: "USER",
				actorId: owner.id,
				type: "agent.created",
				summary: "Installed Terraeagle sales agent template",
			},
		});
	});
	console.log(`Installed ${name}`);
}

await db.$disconnect();
