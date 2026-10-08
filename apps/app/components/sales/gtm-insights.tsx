"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { marketName } from "@crm/validation/gtm-market";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
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
	const [serviceId, setServiceId] = useState("ALL");
	const [countryCode, setCountryCode] = useState("ALL");
	const selected = data.marketRows.filter(
		(row) =>
			(serviceId === "ALL" || row.serviceId === serviceId) &&
			(countryCode === "ALL" || row.marketCountryCode === countryCode),
	);
	const sum = (
		key:
			| "campaigns"
			| "campaignTargets"
			| "qualified"
			| "drafts"
			| "approved"
			| "sent"
			| "replies",
	) => selected.reduce((total, row) => total + row[key], 0);
	const cards = [
		["Campaigns", sum("campaigns")],
		["Campaign targets", sum("campaignTargets")],
		["Verified Filo fit", sum("qualified")],
		["Campaign drafts", sum("drafts")],
		["Campaign approvals", sum("approved")],
		["Campaign emails sent", sum("sent")],
		["Campaign replies", sum("replies")],
	] as Array<[string, number]>;
	const serviceOptions = [
		...new Map(
			data.marketRows.map((row) => [row.serviceId, row.serviceName]),
		).entries(),
	];
	const countryOptions = [
		...new Set(data.marketRows.map((row) => row.marketCountryCode)),
	].sort();
	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2">
				<Select
					value={serviceId}
					onValueChange={(value: string) => setServiceId(value)}
				>
					<SelectTrigger aria-label="Filter service">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All services</SelectItem>
						{serviceOptions.map(([id, name]) => (
							<SelectItem key={id} value={id}>
								{name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={countryCode}
					onValueChange={(value: string) => setCountryCode(value)}
				>
					<SelectTrigger aria-label="Filter country">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All countries</SelectItem>
						{countryOptions.map((code) => (
							<SelectItem key={code} value={code}>
								{marketName(code)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<section
				aria-label="Terraeagle GTM metrics"
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
				<h2 className="font-medium">Service and country activity</h2>
				{selected.length ? (
					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						{selected.map((row) => (
							<div
								key={`${row.serviceId}:${row.marketCountryCode}`}
								className="rounded-md border p-3 text-sm"
							>
								<strong>
									{row.serviceName} · {marketName(row.marketCountryCode)}
								</strong>
								<p className="mt-1 text-muted-foreground">
									{row.companies} companies · {row.campaigns} campaigns ·{" "}
									{row.campaignTargets} targets
									{row.qualified ? ` · ${row.qualified} meet Filo gate` : ""}
									{" · "}
									{row.drafts} drafts · {row.sent} sent · {row.replies} replies
								</p>
							</div>
						))}
					</div>
				) : (
					<p className="mt-3 text-muted-foreground text-sm">
						No campaigns match these filters.
					</p>
				)}
			</section>
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Campaign readiness</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Each service has its own qualification guidance. Every email still
					needs approval.
				</p>
				{campaigns.data?.filter(
					(campaign) =>
						(serviceId === "ALL" || campaign.serviceId === serviceId) &&
						(countryCode === "ALL" ||
							campaign.marketCountryCode === countryCode),
				).length ? (
					<div className="mt-4 space-y-2">
						{campaigns.data
							?.filter(
								(campaign) =>
									(serviceId === "ALL" || campaign.serviceId === serviceId) &&
									(countryCode === "ALL" ||
										campaign.marketCountryCode === countryCode),
							)
							.map((campaign) => (
								<Link
									key={campaign.id}
									href={workspaceUrl(`/outreach/campaigns/${campaign.id}`)}
									className="block rounded-lg border p-3 hover:bg-muted/50"
								>
									<span className="font-medium text-sm">{campaign.name}</span>
									<span className="mt-1 block text-muted-foreground text-xs">
										{campaign.targetCount}{" "}
										{campaign.targetCount === 1 ? "target" : "targets"} ·{" "}
										{campaign.serviceName} ·{" "}
										{marketName(campaign.marketCountryCode)} ·{" "}
										{campaign.stepCount} steps · {campaign.status.toLowerCase()}
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
