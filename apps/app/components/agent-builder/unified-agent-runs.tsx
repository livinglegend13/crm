"use client";

import { Input } from "@crm/ui/components/input";
import { Markdown } from "@crm/ui/components/markdown";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AgentResultView } from "./agent-result-view";

type Runs = RouterOutputs["agents"]["recentRuns"];

export function UnifiedAgentRuns({ initialRuns }: { initialRuns: Runs }) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const [search, setSearch] = useState("");
	const runs = useQuery({
		...trpc.agents.recentRuns.queryOptions({ limit: 100 }),
		initialData: initialRuns,
	});
	const term = search.trim().toLowerCase();
	const visible = (runs.data ?? initialRuns).filter((run) =>
		`${run.agent.name} ${run.context.focus ?? ""} ${run.context.target?.label ?? ""} ${run.context.campaignName ?? ""} ${run.context.serviceName ?? ""} ${run.summary ?? ""}`
			.toLowerCase()
			.includes(term),
	);
	return (
		<section className="mb-6 rounded-lg border bg-card p-5">
			<h2 className="font-medium">Agent output across the team</h2>
			<p className="mt-1 text-muted-foreground text-sm">
				Recent runs from every agent, newest first. Open a run to read its
				output.
			</p>
			<Input
				className="mt-4"
				aria-label="Search agent output"
				placeholder="Search agent, company, campaign, or service"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>
			<div className="mt-3 divide-y">
				{visible.map((run) => (
					<article key={run.id} className="py-3 first:pt-0 last:pb-0">
						<details>
							<summary className="cursor-pointer list-none rounded-md px-2 py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<span className="block font-medium text-sm">
									{run.agent.name} ·{" "}
									{(
										run.context.target?.label ??
										run.context.campaignName ??
										run.context.focus ??
										"General run"
									).slice(0, 120)}
								</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									{run.status.toLowerCase().replaceAll("_", " ")} ·{" "}
									{new Date(run.createdAt).toLocaleString("en-IN")}
									{run.context.campaignName
										? ` · ${run.context.campaignName}`
										: ""}
								</span>
							</summary>
							<div className="flex flex-col gap-4 px-2 py-3">
								<div className="flex flex-wrap gap-3 text-xs">
									<Link
										href={workspaceUrl(`/agents/${run.agent.id}`)}
										className="text-primary hover:underline"
									>
										Open agent history
									</Link>
									{run.context.target ? (
										<Link
											href={workspaceUrl(
												`/${run.context.target.kind === "company" ? "companies" : `${run.context.target.kind}s`}?record=${run.context.target.kind}:${run.context.target.id}`,
											)}
											className="text-primary hover:underline"
										>
											Open {run.context.target.label}
										</Link>
									) : null}
									{run.context.campaignId ? (
										<Link
											href={workspaceUrl(
												`/outreach/campaigns/${run.context.campaignId}`,
											)}
											className="text-primary hover:underline"
										>
											Open campaign
										</Link>
									) : null}
								</div>
								{run.result && Object.keys(run.result).length ? (
									<AgentResultView result={run.result} />
								) : run.summary ? (
									<Markdown className="text-sm">{run.summary}</Markdown>
								) : (
									<p className="text-muted-foreground text-sm">
										No output saved yet.
									</p>
								)}
								{run.result && run.summary ? (
									<details>
										<summary className="cursor-pointer text-muted-foreground text-xs">
											Run summary
										</summary>
										<Markdown className="mt-2 text-sm">{run.summary}</Markdown>
									</details>
								) : null}
							</div>
						</details>
					</article>
				))}
			</div>
			{visible.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">
					No agent runs match this search.
				</p>
			) : null}
			{(runs.data ?? initialRuns).length === 100 ? (
				<p className="mt-4 text-muted-foreground text-xs">
					Showing the newest 100 runs. Open an agent for its full history.
				</p>
			) : null}
		</section>
	);
}
