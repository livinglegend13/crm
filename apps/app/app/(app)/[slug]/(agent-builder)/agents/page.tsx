import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamAgentsIndex } from "@/components/agent-builder/team-agents-index";
import { UnifiedAgentRuns } from "@/components/agent-builder/unified-agent-runs";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Agents" };

export default function AgentsPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Team agents</PageShellTitle>
					<PageShellDescription>
						Follow campaign agents, approvals, replies, and call handoffs. Open
						an agent to edit its configuration.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0 overflow-y-auto">
				<Suspense fallback={<PageShellLoading />}>
					<PrefetchedTeamAgents />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function PrefetchedTeamAgents() {
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	const [agents, campaigns, runs] = await Promise.all([
		queryClient.fetchQuery(trpc.agents.list.queryOptions()),
		queryClient.fetchQuery(trpc.gtm.campaigns.queryOptions()),
		queryClient.fetchQuery(trpc.agents.recentRuns.queryOptions({ limit: 100 })),
	]);

	return (
		<HydrateClient>
			<UnifiedAgentRuns initialRuns={runs} />
			<TeamAgentsIndex initialAgents={agents} initialCampaigns={campaigns} />
		</HydrateClient>
	);
}
