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
import { CampaignEditor } from "@/components/sales/campaign-editor";
import { GtmNav } from "@/components/sales/gtm-nav";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Campaign plan" };

export default function CampaignPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<CampaignContent params={params} />
		</Suspense>
	);
}

async function CampaignContent({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await connection();
	const { id } = await params;
	const client = getServerTrpcClient();
	const campaign = await client.gtm.campaign.query({ id });
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>{campaign.name}</PageShellTitle>
					<PageShellDescription>
						Configure this India campaign plan. The plan does not send email
						automatically.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="campaigns" />
				<CampaignEditor initialCampaign={campaign} />
			</PageShellContent>
		</PageShell>
	);
}
