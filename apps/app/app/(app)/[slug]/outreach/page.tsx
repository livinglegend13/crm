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

export const metadata: Metadata = { title: "Outreach drafts" };

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
					<PageShellTitle>Outreach drafts</PageShellTitle>
					<PageShellDescription>
						Edit and save drafts for approval. The CRM does not send email.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<DraftWorkspace initialDrafts={drafts} selectedRunId={draft} />
			</PageShellContent>
		</PageShell>
	);
}
