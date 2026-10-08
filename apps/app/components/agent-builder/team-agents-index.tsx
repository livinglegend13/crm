"use client";

import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import Bot from "@carbon/icons-react/es/Bot";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { CampaignWorkflowGraph } from "./campaign-workflow-graph";

type Agents = RouterOutputs["agents"]["list"];
type Campaigns = RouterOutputs["gtm"]["campaigns"];

export function TeamAgentsIndex({
	initialAgents,
	initialCampaigns,
}: {
	initialAgents: Agents;
	initialCampaigns: Campaigns;
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const [search, setSearch] = useState("");
	const agents = useQuery({
		...trpc.agents.list.queryOptions(),
		initialData: initialAgents,
	});
	const rows = agents.data ?? initialAgents;
	const visible = rows.filter((agent) =>
		`${agent.name} ${agent.description ?? ""}`
			.toLowerCase()
			.includes(search.trim().toLowerCase()),
	);

	return (
		<>
			<CampaignWorkflowGraph
				initialCampaigns={initialCampaigns}
				agents={rows}
			/>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-medium">All {rows.length} team agents</h2>
					<p className="text-muted-foreground text-sm">
						Open an agent to edit its prompt, schedule runs, and review output.
					</p>
				</div>
				<Link
					href={workspaceUrl("/chat")}
					className="text-primary text-sm hover:underline"
				>
					Create an agent
				</Link>
			</div>
			<Input
				aria-label="Search team agents"
				className="mb-4"
				onChange={(event) => setSearch(event.target.value)}
				placeholder="Search all agents"
				value={search}
			/>
			{rows.length ? (
				<div className="shrink-0 overflow-hidden rounded-lg border bg-card">
					{visible.map((agent) => (
						<Link
							key={agent.id}
							href={workspaceUrl(`/agents/${agent.id}`)}
							transitionTypes={["nav-forward"]}
							className="flex min-h-16 min-w-0 items-start gap-3 border-t px-4 py-4 outline-none first:border-t-0 hover:bg-muted/50 focus-visible:bg-muted/50 sm:items-center sm:gap-4 sm:px-5 sm:py-3"
						>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
								<Icon icon={Bot} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
									<span className="min-w-0 wrap-break-word font-medium text-sm sm:truncate">
										{agent.name}
									</span>
									<span className="shrink-0 text-muted-foreground text-xs">
										{agent.status.toLowerCase()}
									</span>
								</span>
								<span className="mt-1 block wrap-break-word text-muted-foreground text-xs sm:mt-0 sm:truncate">
									{agent.description ?? "No description"}
								</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									{agent.runCount} runs · Latest:{" "}
									{agent.latestRun?.status.toLowerCase().replaceAll("_", " ") ??
										"No runs"}
								</span>
								<span className="mt-2 block font-mono text-muted-foreground text-xs sm:hidden">
									{agent.runCount} runs
								</span>
							</span>
							<span className="hidden shrink-0 font-mono text-muted-foreground text-xs sm:inline">
								{agent.triggers.some((trigger) => trigger.type === "SCHEDULE")
									? "Scheduled"
									: "Manual"}{" "}
								· Open controls
							</span>
							<Icon
								icon={ArrowRight}
								className="size-4 text-muted-foreground"
							/>
						</Link>
					))}
					{visible.length === 0 ? (
						<p className="p-6 text-sm text-muted-foreground">
							No agents match this search.
						</p>
					) : null}
				</div>
			) : (
				<div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
					<Icon icon={Bot} className="size-6 text-muted-foreground" />
					<h2 className="mt-4 font-medium text-sm">No team agents yet</h2>
					<p className="mt-1 text-muted-foreground text-xs">
						Create one from a private chat, then review its access before
						deploying it.
					</p>
					<Link
						href={workspaceUrl("/chat")}
						className="mt-4 text-primary text-xs hover:underline"
					>
						Open chat
					</Link>
				</div>
			)}
		</>
	);
}
