import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
	PageShellFallback,
} from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<ResearchContent params={params} />
		</Suspense>
	);
}

async function ResearchContent({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	await connection();
	const { slug } = await params;
	const client = getServerTrpcClient();
	const agents = (await client.agents.list.query()).filter((agent) =>
		/research|qualif/i.test(agent.name),
	);
	const rows = await Promise.all(
		agents.map(async (agent) => ({
			agent,
			runs: await client.agents.history.query({ id: agent.id, limit: 10 }),
		})),
	);

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Research</PageShellTitle>
					<PageShellDescription>
						Review qualification runs and their evidence before changing a
						company’s Filo fit.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				{rows.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-sm">
						No research agents are visible in this workspace.
					</div>
				) : (
					<div className="flex flex-col gap-5">
						{rows.map(({ agent, runs }) => (
							<section key={agent.id} className="rounded-lg border bg-card p-5">
								<h2 className="font-medium text-base">{agent.name}</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									{runs.length} recent runs
								</p>
								{runs.map((run) => (
									<div key={run.id} className="mt-4 border-t pt-4">
										<p className="text-sm">
											{run.summary || "No summary saved"}
										</p>
										<span className="mt-2 block text-muted-foreground text-xs">
											{run.status.toLowerCase()} ·{" "}
											{new Date(run.createdAt).toLocaleString("en-IN")}
										</span>
									</div>
								))}
								<Link
									href={`/${slug}/agents/${agent.id}`}
									className="mt-4 inline-block text-primary text-xs hover:underline"
								>
									Open agent and full run history
								</Link>
							</section>
						))}
					</div>
				)}
			</PageShellContent>
		</PageShell>
	);
}
