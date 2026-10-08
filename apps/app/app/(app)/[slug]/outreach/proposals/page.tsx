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
import { GtmNav } from "@/components/sales/gtm-nav";
import { ProposalKnowledge } from "@/components/sales/proposal-knowledge";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Proposal knowledge" };

export default function ProposalsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<ProposalsContent />
		</Suspense>
	);
}

async function ProposalsContent() {
	await connection();
	const client = getServerTrpcClient();
	const [knowledge, services] = await Promise.all([
		client.gtm.proposalKnowledge.query(),
		client.gtm.services.query(),
	]);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Proposal knowledge</PageShellTitle>
					<PageShellDescription>
						Review Terraeagle proposal examples before the Proposal Strategist
						uses them.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="proposals" />
				<ProposalKnowledge initialKnowledge={knowledge} services={services} />
			</PageShellContent>
		</PageShell>
	);
}
