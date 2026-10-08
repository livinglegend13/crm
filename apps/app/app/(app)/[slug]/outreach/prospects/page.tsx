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
import { ProspectBoard } from "@/components/sales/prospect-board";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Prospecting" };

export default function ProspectsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<ProspectsContent />
		</Suspense>
	);
}

async function ProspectsContent() {
	await connection();
	const client = getServerTrpcClient();
	const campaigns = await client.gtm.campaigns.query();
	const prospects = await client.gtm.prospects.query({
		campaignId: campaigns[0]?.id,
		q: "",
		decision: "ALL",
		offset: 0,
		limit: 25,
	});
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Prospecting</PageShellTitle>
					<PageShellDescription>
						Find companies for a service campaign. Review evidence before
						qualification and outreach.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="prospects" />
				<ProspectBoard
					initialProspects={prospects}
					initialCampaigns={campaigns}
				/>
			</PageShellContent>
		</PageShell>
	);
}
