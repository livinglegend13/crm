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
import { GtmInsights } from "@/components/sales/gtm-insights";
import { GtmNav } from "@/components/sales/gtm-nav";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "GTM insights" };

export default function InsightsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<InsightsContent />
		</Suspense>
	);
}

async function InsightsContent() {
	await connection();
	const client = getServerTrpcClient();
	const [insights, campaigns] = await Promise.all([
		client.gtm.insights.query(),
		client.gtm.campaigns.query(),
	]);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>GTM insights</PageShellTitle>
					<PageShellDescription>
						Track campaigns by Terraeagle service and country, with outreach
						activity and approval status.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="insights" />
				<GtmInsights initialInsights={insights} initialCampaigns={campaigns} />
			</PageShellContent>
		</PageShell>
	);
}
