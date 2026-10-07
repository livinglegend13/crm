"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Insights = RouterOutputs["gtm"]["insights"];
type Campaigns = RouterOutputs["gtm"]["campaigns"];

export function GtmInsights({
	initialInsights,
	initialCampaigns,
}: {
	initialInsights: Insights;
	initialCampaigns: Campaigns;
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const insights = useQuery({
		...trpc.gtm.insights.queryOptions(),
		initialData: initialInsights,
	});
	const campaigns = useQuery({
		...trpc.gtm.campaigns.queryOptions(),
		initialData: initialCampaigns,
	});
	const data = insights.data ?? initialInsights;
	const cards = [
		["India companies", data.indiaCompanies],
		["Evidence needed", data.reviewsNeeded],
		["Meet 1 PB gate", data.qualified],
		["Below gate", data.belowGate],
		["Campaigns", data.campaigns],
		["Campaign targets", data.campaignTargets],
		["Saved drafts", data.drafts],
		["Approved drafts", data.approved],
		["Sent emails", data.sent],
		["Matched replies", data.replies],
	] as const;
	return (
		<div className="space-y-6">
			<section
				aria-label="Filo GTM metrics"
				className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
			>
				{cards.map(([label, value]) => (
					<div key={label} className="rounded-lg border bg-card p-4">
						<p className="text-muted-foreground text-xs">{label}</p>
						<p className="mt-2 font-semibold text-2xl">{value}</p>
					</div>
				))}
			</section>
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Campaign readiness</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Qualification depends on documented capacity. No campaign sends
					automatically.
				</p>
				{campaigns.data?.length ? (
					<div className="mt-4 space-y-2">
						{campaigns.data.map((campaign) => (
							<Link
								key={campaign.id}
								href={workspaceUrl(`/outreach/campaigns/${campaign.id}`)}
								className="block rounded-lg border p-3 hover:bg-muted/50"
							>
								<span className="font-medium text-sm">{campaign.name}</span>
								<span className="mt-1 block text-muted-foreground text-xs">
									{campaign.targetCount}{" "}
									{campaign.targetCount === 1 ? "target" : "targets"} ·{" "}
									{campaign.qualifiedCount} meet gate · {campaign.stepCount}{" "}
									steps · {campaign.status.toLowerCase()}
								</span>
							</Link>
						))}
					</div>
				) : (
					<p className="mt-4 text-muted-foreground text-sm">
						Create a campaign to track targets and sequence plans.
					</p>
				)}
			</section>
		</div>
	);
}
