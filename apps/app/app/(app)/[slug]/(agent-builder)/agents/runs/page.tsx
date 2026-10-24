import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Agent output" };

export default function AgentOutputPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Agent output</PageShellTitle>
					<PageShellDescription>
						Review recent runs from every team agent.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<OutputContent params={params} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function OutputContent({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const runs = await getServerTrpcClient().agents.recentRuns.query({
		limit: 100,
	});
	return (
		<>
			<Link
				href={`/${slug}/agents`}
				className="mb-4 inline-block text-primary text-sm hover:underline"
			>
				Back to agents
			</Link>
			<UnifiedAgentRuns initialRuns={runs} />
		</>
	);
}
