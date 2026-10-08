"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	WorkflowConnector,
	WorkflowNode,
	type WorkflowNodeState,
} from "@crm/ui/components/workflow-node";
import { marketName } from "@crm/validation/gtm-market";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { GTM_VIEW } from "@/components/sales/gtm-config";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Agents = RouterOutputs["agents"]["list"];
type Campaigns = RouterOutputs["gtm"]["campaigns"];
type Campaign = RouterOutputs["gtm"]["campaign"];
type Run = Campaign["targets"][number]["agentRuns"][number];

type FlowNode = {
	id: string;
	step: string;
	title: string;
	description: string;
	state: WorkflowNodeState;
	owner: string;
	summary: string;
	agentId?: string;
	runId?: string;
	draftRunId?: string;
	callAction?: boolean;
};

function runState(run: Run | undefined): WorkflowNodeState {
	if (!run) return "waiting";
	if (run.status === "FAILED" || run.status === "CANCELLED") return "attention";
	if (
		run.status === "QUEUED" ||
		run.status === "RUNNING" ||
		run.status === "WAITING_FOR_APPROVAL"
	)
		return "running";
	return "complete";
}

function reviewState(run: Run | undefined): WorkflowNodeState {
	if (!run?.hasDraft) return "waiting";
	if (run.draftStatus === "SENDING") return "running";
	if (run.draftStatus === "SENT") return "complete";
	if (run.draftStatus === "APPROVED") return "ready";
	return "attention";
}

function runSummary(run: Run | undefined) {
	return run?.errorMessage ?? run?.summary ?? "No run output is available yet.";
}

function buildWorkflowModel(
	detail: Campaign | undefined,
	target: Campaign["targets"][number] | undefined,
	agents: Agents,
	callTask: { data: RouterOutputs["gtm"]["callTask"] | undefined },
	selectedId: string,
) {
	const findRun = (
		agentId: string,
		stageIndex?: number,
		stepPosition?: number,
	) =>
		target?.agentRuns.find(
			(run) =>
				run.agentId === agentId &&
				(stageIndex === undefined ||
					run.workflowVersion === detail?.workflowVersion) &&
				(stageIndex === undefined || run.workflowStageIndex === stageIndex) &&
				(stepPosition === undefined || run.stepPosition === stepPosition),
		);
	const research = findRun("terraeagle-sales-company");
	const nodes: FlowNode[] = [
		{
			id: "prospect",
			step: "1 · Prospect",
			title: target?.companyName ?? "Select a prospect",
			description: target?.contactName ?? "Choose a buyer contact",
			state: target ? "complete" : "waiting",
			owner: "Sales owner",
			summary: target
				? `${target.companyName} is a target in ${detail?.name}.`
				: "Add a target to this campaign.",
		},
		{
			id: "research",
			step: "2 · Research",
			title:
				agents.find((agent) => agent.id === "terraeagle-sales-company")?.name ??
				"Company research",
			description:
				research?.status.toLowerCase().replaceAll("_", " ") ??
				"Waiting for research",
			state: runState(research),
			owner: "Research agent",
			summary: runSummary(research),
			agentId: "terraeagle-sales-company",
			runId: research?.id,
		},
	];
	for (const [index, agentId] of (detail?.workflowAgentIds ?? []).entries()) {
		const run = findRun(agentId, index);
		nodes.push({
			id: `agent-${index}`,
			step: `${index + 3} · Advisory`,
			title: agents.find((agent) => agent.id === agentId)?.name ?? agentId,
			description:
				run?.status.toLowerCase().replaceAll("_", " ") ??
				"Waiting for prior agent",
			state: runState(run),
			owner: "Configured agent",
			summary: runSummary(run),
			agentId,
			runId: run?.id,
		});
	}
	for (const step of detail?.steps ?? []) {
		const run = findRun(
			"terraeagle-sales-outbound-strategist",
			undefined,
			step.position,
		);
		nodes.push({
			id: `draft-${step.position}`,
			step: `Email ${step.position + 1} · Draft`,
			title: "Personalized outreach",
			description:
				run?.status.toLowerCase().replaceAll("_", " ") ??
				"Waiting for prior step",
			state: runState(run),
			owner: "Outreach agent",
			summary: runSummary(run),
			agentId: "terraeagle-sales-outbound-strategist",
			runId: run?.id,
			draftRunId: run?.hasDraft ? run.id : undefined,
		});
		nodes.push({
			id: `review-${step.position}`,
			step: `Email ${step.position + 1} · Human gate`,
			title: "Review and send",
			description:
				run?.draftStatus?.toLowerCase().replaceAll("_", " ") ??
				"Waiting for draft",
			state: reviewState(run),
			owner: "Sales owner",
			summary: run?.hasDraft
				? "Edit the email, approve it, then send it from a connected mailbox. Sending remains paused until DKIM works."
				: "The outreach agent creates an editable draft for approval.",
			draftRunId: run?.hasDraft ? run.id : undefined,
		});
	}
	const replyCount =
		target?.agentRuns.reduce((count, run) => count + run.replyCount, 0) ?? 0;
	const sentCount =
		target?.agentRuns.filter((run) => run.draftStatus === "SENT").length ?? 0;
	nodes.push({
		id: "replies",
		step: "Reply monitoring",
		title: `${replyCount} matched replies`,
		description: sentCount
			? `${sentCount} sent email steps`
			: "Starts after sending",
		state: replyCount ? "attention" : sentCount ? "running" : "waiting",
		owner: "Inbox and sales owner",
		summary: replyCount
			? "A reply needs human review. Further follow-ups stop after a matched reply."
			: "The CRM checks replies to sent campaign emails.",
	});
	const dueAt = callTask.data?.dueAt ? new Date(callTask.data.dueAt) : null;
	const callState: WorkflowNodeState =
		research?.status !== "SUCCEEDED"
			? "waiting"
			: dueAt && dueAt <= new Date()
				? "attention"
				: callTask.data
					? "ready"
					: "attention";
	const callNodes: [FlowNode, FlowNode] = [
		{
			id: "call-cue",
			step: "Research handoff",
			title: "Call cues",
			description:
				research?.status === "SUCCEEDED"
					? "Research is ready"
					: "Waiting for research",
			state: research?.status === "SUCCEEDED" ? "ready" : "waiting",
			owner: "Sales owner",
			summary: runSummary(research),
			runId: research?.id,
		},
		{
			id: "call-reminder",
			step: "Human call",
			title: callTask.data ? "Call reminder" : "Schedule a call",
			description: dueAt
				? dueAt.toLocaleString()
				: "Create a task from research cues",
			state: callState,
			owner: "Sales owner",
			summary: callTask.data
				? `Your call task is due ${dueAt?.toLocaleString() ?? "without a date"}. Open My Tasks to complete it.`
				: "The CRM does not place calls. Review cues and choose a reminder time in the campaign target.",
			callAction: true,
		},
	];
	const selectedNode =
		[...nodes, ...callNodes].find((node) => node.id === selectedId) ??
		nodes[1] ??
		callNodes[0];
	const activeAgentIds = new Set([
		"terraeagle-sales-company",
		"terraeagle-sales-outbound-strategist",
		...(detail?.workflowAgentIds ?? []),
	]);

	return { nodes, callNodes, selectedNode, activeAgentIds, callState };
}

export function CampaignWorkflowGraph({
	initialCampaigns,
	agents,
}: {
	initialCampaigns: Campaigns;
	agents: Agents;
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const campaigns = useQuery({
		...trpc.gtm.campaigns.queryOptions(),
		initialData: initialCampaigns,
	});
	const rows = campaigns.data ?? initialCampaigns;
	const [campaignId, setCampaignId] = useState(
		rows.find((row) => row.status === "READY")?.id ?? rows[0]?.id ?? "",
	);
	const [targetId, setTargetId] = useState("");
	const [selectedId, setSelectedId] = useState("research");
	const selectedCampaignId = rows.some((row) => row.id === campaignId)
		? campaignId
		: (rows[0]?.id ?? "");
	const campaign = useQuery({
		...trpc.gtm.campaign.queryOptions({ id: selectedCampaignId }),
		enabled: Boolean(selectedCampaignId),
		refetchInterval: GTM_VIEW.poll.readyMs,
	});
	const detail = campaign.data;
	const target =
		detail?.targets.find((row) => row.id === targetId) ?? detail?.targets[0];
	const callTask = useQuery({
		...trpc.gtm.callTask.queryOptions({
			id: selectedCampaignId,
			targetId: target?.id ?? "",
		}),
		enabled: Boolean(selectedCampaignId && target),
		refetchInterval: GTM_VIEW.poll.readyMs,
	});
	const { nodes, callNodes, selectedNode, activeAgentIds, callState } =
		buildWorkflowModel(detail, target, agents, callTask, selectedId);

	return (
		<section
			aria-label="Campaign agent workflow"
			className="mb-8 space-y-4 rounded-lg border bg-card p-5"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-medium">Sales workflow</h2>
					<p className="text-muted-foreground text-sm">
						Live campaign stages connect agents, approvals, replies, and human
						calls.
					</p>
				</div>
				{detail ? (
					<Badge variant="outline">
						{activeAgentIds.size} connected agents ·{" "}
						{detail.workflowAgentIds.length} advisory
					</Badge>
				) : null}
			</div>
			{rows.length ? (
				<>
					<div className="flex flex-wrap gap-3">
						<Select
							value={selectedCampaignId}
							onValueChange={(value) => {
								setCampaignId(value);
								setTargetId("");
								setSelectedId("research");
							}}
						>
							<SelectTrigger aria-label="Select campaign" className="w-64">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{rows.map((row) => (
									<SelectItem key={row.id} value={row.id}>
										{row.name} · {row.serviceName} ·{" "}
										{marketName(row.marketCountryCode)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{detail?.targets.length ? (
							<Select
								value={target?.id ?? ""}
								onValueChange={(value) => {
									setTargetId(value);
									setSelectedId("research");
								}}
							>
								<SelectTrigger aria-label="Select prospect" className="w-56">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{detail.targets.map((row) => (
										<SelectItem key={row.id} value={row.id}>
											{row.companyName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : null}
						{detail ? (
							<Button asChild size="sm" variant="outline">
								<Link href={workspaceUrl(`/outreach/campaigns/${detail.id}`)}>
									Edit sequence
								</Link>
							</Button>
						) : null}
					</div>
					{campaign.isPending ? (
						<p className="text-muted-foreground text-sm">Loading workflow…</p>
					) : null}
					{campaign.isError ? (
						<p className="text-destructive text-sm">
							Workflow failed to load. {campaign.error.message}
						</p>
					) : null}
					{detail ? (
						<>
							<section
								className="overflow-x-auto rounded-lg border bg-background p-5"
								aria-label="Connected agent stages"
							>
								<ol className="flex w-max items-center">
									{nodes.map((node, index) => (
										<li key={node.id} className="flex items-center">
											{index ? (
												<WorkflowConnector
													active={
														nodes[index - 1]?.state === "complete" ||
														nodes[index - 1]?.state === "running"
													}
												/>
											) : null}
											<WorkflowNode
												step={node.step}
												title={node.title}
												description={node.description}
												state={node.state}
												selected={selectedNode.id === node.id}
												onClick={() => setSelectedId(node.id)}
											/>
										</li>
									))}
								</ol>
							</section>
							<div className="overflow-x-auto">
								<p className="mb-2 text-muted-foreground text-xs">
									Call lane · branches after research
								</p>
								<div className="flex w-max items-center">
									<WorkflowNode
										step={callNodes[0].step}
										title={callNodes[0].title}
										description={callNodes[0].description}
										state={callNodes[0].state}
										selected={selectedNode.id === "call-cue"}
										onClick={() => setSelectedId("call-cue")}
									/>
									<WorkflowConnector active={callNodes[0].state === "ready"} />
									<WorkflowNode
										step={callNodes[1].step}
										title={callNodes[1].title}
										description={callNodes[1].description}
										state={callNodes[1].state}
										selected={selectedNode.id === "call-reminder"}
										onClick={() => setSelectedId("call-reminder")}
									/>
								</div>
							</div>
							<div
								className="rounded-lg border bg-background p-4"
								aria-live="polite"
							>
								<div className="flex flex-wrap items-center gap-2">
									<h3 className="font-medium text-sm">{selectedNode.title}</h3>
									<Badge variant="outline" className="capitalize">
										{selectedNode.state}
									</Badge>
									<span className="text-muted-foreground text-xs">
										Owner: {selectedNode.owner}
									</span>
								</div>
								<p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-muted-foreground text-sm">
									{selectedNode.summary}
								</p>
								<div className="mt-3 flex flex-wrap gap-3 text-sm">
									{selectedNode.agentId &&
									agents.some((agent) => agent.id === selectedNode.agentId) ? (
										<Link
											className="text-primary underline"
											href={workspaceUrl(`/agents/${selectedNode.agentId}`)}
										>
											Configure agent
										</Link>
									) : null}
									{selectedNode.runId && target ? (
										<Link
											className="text-primary underline"
											href={workspaceUrl(
												`/outreach/campaigns/${detail.id}#campaign-target-${target.id}`,
											)}
										>
											Review run output
										</Link>
									) : null}
									{selectedNode.draftRunId ? (
										<Link
											className="text-primary underline"
											href={workspaceUrl(
												`/outreach?draft=${selectedNode.draftRunId}`,
											)}
										>
											Open editable draft
										</Link>
									) : null}
									{selectedNode.callAction && target ? (
										<Link
											className="text-primary underline"
											href={workspaceUrl(
												callTask.data
													? "/"
													: `/outreach/campaigns/${detail.id}#campaign-target-${target.id}`,
											)}
										>
											{callTask.data
												? "Open call task"
												: "Prepare call and reminder"}
										</Link>
									) : null}
								</div>
							</div>
							{target && callState === "attention" ? (
								<p className="text-destructive text-sm" role="status">
									Call action needs attention for {target.companyName}. Open the
									call lane to review cues and reminders.
								</p>
							) : null}
						</>
					) : null}
				</>
			) : (
				<p className="text-muted-foreground text-sm">
					Create a campaign to connect agents in a sales sequence.{" "}
					<Link
						className="text-primary underline"
						href={workspaceUrl("/outreach/campaigns")}
					>
						Open campaigns
					</Link>
				</p>
			)}
		</section>
	);
}
