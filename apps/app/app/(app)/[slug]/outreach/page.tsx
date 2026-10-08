import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellFallback,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { DraftWorkspace } from "@/components/sales/draft-workspace";
import { GtmNav } from "@/components/sales/gtm-nav";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Outreach" };

export default function OutreachPage({
	searchParams,
}: {
	searchParams: Promise<{ draft?: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<OutreachContent searchParams={searchParams} />
		</Suspense>
	);
}

async function OutreachContent({
	searchParams,
}: {
	searchParams: Promise<{ draft?: string }>;
}) {
	await connection();
	const { draft } = await searchParams;
	const client = getServerTrpcClient();
	const [drafts, stats] = await Promise.all([
		client.outreachDrafts.list.query(),
		client.outreachDrafts.stats.query(),
	]);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Outreach</PageShellTitle>
					<PageShellDescription>
						Review research, edit emails, approve each draft, and send from a
						connected Microsoft 365 sender.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="drafts" />
				<section
					aria-label="Recent outreach activity"
					className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
				>
					{[
						["Recent drafts", stats.drafts],
						["Recent approved", stats.approved],
						["Recent sent", stats.sent],
						["Replies", stats.replies],
						["Agent runs", stats.agentRuns],
						["Failed runs", stats.failedRuns],
					].map(([label, value]) => (
						<div key={label} className="rounded-lg border bg-card p-4">
							<p className="text-muted-foreground text-xs">{label}</p>
							<p className="mt-2 font-semibold text-2xl">{value}</p>
						</div>
					))}
				</section>
				<DraftWorkspace initialDrafts={drafts} selectedRunId={draft} />
			</PageShellContent>
		</PageShell>
	);
}
