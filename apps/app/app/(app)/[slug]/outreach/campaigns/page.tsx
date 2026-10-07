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
import { CampaignList } from "@/components/sales/campaign-list";
import { GtmNav } from "@/components/sales/gtm-nav";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "GTM campaigns" };

export default async function CampaignsPage() {
	await connection();
	const client = getServerTrpcClient();
	const campaigns = await client.gtm.campaigns.query();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Campaigns</PageShellTitle>
					<PageShellDescription>
						Plan targets, email steps, and sending windows. Every customer email still needs approval.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="campaigns" />
				<CampaignList initialCampaigns={campaigns} />
			</PageShellContent>
		</PageShell>
	);
}
