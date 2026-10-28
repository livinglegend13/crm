"use client";

import { Badge } from "@crm/ui/components/badge";
import { Markdown } from "@crm/ui/components/markdown";
import type { EveToolOutput } from "@crm/validation/eve-tool";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { z } from "zod";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AgentResultView } from "./agent-result-view";

const runLink = z.object({
	runId: z.string().min(1),
	agentId: z.string().min(1),
	agentName: z.string().min(1),
	recordLabel: z.string().min(1),
	status: z.string(),
});

export function chatAgentRunLink(output: EveToolOutput) {
	const parsed = runLink.safeParse(output);
	return parsed.success ? parsed.data : null;
}

export function ChatAgentRunCard({
	result,
}: {
	result: z.infer<typeof runLink>;
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const history = useQuery({
		...trpc.agents.history.queryOptions({ id: result.agentId, limit: 50 }),
		refetchInterval: (query) => {
			const run = query.state.data?.find((row) => row.id === result.runId);
			return run && ["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)
				? false
				: 3000;
		},
	});
	const run = history.data?.find((row) => row.id === result.runId);
	return (
		<div className="min-w-0 rounded-lg border bg-card p-4 text-sm">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="font-medium">{result.agentName}</div>
				<Badge variant="outline">{run?.status ?? result.status}</Badge>
			</div>
			<p className="mt-1 text-muted-foreground">For {result.recordLabel}</p>
			{run?.summary ? (
				<Markdown className="mt-3 wrap-break-word leading-5">
					{run.summary}
				</Markdown>
			) : null}
			{run?.result && Object.keys(run.result).length > 0 ? (
				<details className="mt-3 rounded-md border p-3">
					<summary className="cursor-pointer font-medium">View findings and sources</summary>
					<div className="mt-3">
						<AgentResultView result={run.result} />
					</div>
				</details>
			) : null}
			{run?.errorMessage ? (
				<p className="mt-3 text-destructive">{run.errorMessage}</p>
			) : null}
			<Link
				href={workspaceUrl(`/agents/${result.agentId}`)}
				className="mt-3 inline-block text-primary underline"
			>
				Open full run and output
			</Link>
		</div>
	);
}
