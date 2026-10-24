import { marketName } from "@crm/validation/gtm-market";
import type { Metadata } from "next";
import Link from "next/link";
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
import { ResearchBrowser } from "@/components/research/research-browser";
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
	const [feed, campaigns] = await Promise.all([
		client.activities.researchFeed.query({ limit: 20, query: "" }),
		client.gtm.campaigns.query(),
	]);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Research</PageShellTitle>
					<PageShellDescription>
						Find cited account research across Terraeagle services.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<ResearchBrowser initialFeed={feed} />
				<section className="rounded-lg border bg-card p-5">
					<h2 className="font-medium">Campaign research</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Open a campaign to view its targets and agent handoffs.
					</p>
					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						{campaigns.map((campaign) => (
							<Link
								key={campaign.id}
								href={`/${slug}/outreach/campaigns/${campaign.id}`}
								className="rounded-md border p-3 text-sm hover:bg-muted/50"
							>
								<strong>{campaign.name}</strong>
								<span className="mt-1 block text-muted-foreground">
									{campaign.serviceName} ·{" "}
									{marketName(campaign.marketCountryCode)} ·{" "}
									{campaign.targetCount} targets
								</span>
							</Link>
						))}
					</div>
					{campaigns.length === 0 ? (
						<p className="mt-3 text-muted-foreground text-sm">
							Create a campaign to start service research.
						</p>
					) : null}
				</section>
			</PageShellContent>
		</PageShell>
	);
}
