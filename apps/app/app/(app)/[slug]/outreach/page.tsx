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
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Filo outreach" };

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
	const drafts = await client.outreachDrafts.list.query();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Filo outreach</PageShellTitle>
					<PageShellDescription>
						Review research, edit emails, and approve each draft. Outlook
						handles sending.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<section className="mb-6 rounded-lg border bg-card p-5 text-sm">
					<h2 className="font-medium">Filo Storage · India</h2>
					<p className="mt-2 text-muted-foreground">
						Terraeagle distributes Filo Storage. Qualification needs evidence of
						at least 1 PB average stored capacity across a defined 12-month
						period. An unknown capacity stays unqualified.
					</p>
				</section>
				<DraftWorkspace initialDrafts={drafts} selectedRunId={draft} />
			</PageShellContent>
		</PageShell>
	);
}
