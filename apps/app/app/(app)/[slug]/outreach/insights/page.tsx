import type { Metadata } from "next";
import { connection } from "next/server";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { GtmNav } from "@/components/sales/gtm-nav";
import { GtmInsights } from "@/components/sales/gtm-insights";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "GTM insights" };

export default async function InsightsPage() {
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
						Track Filo qualification, campaign planning, draft approval, sent mail, and replies.
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
