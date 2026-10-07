"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Campaigns = RouterOutputs["gtm"]["campaigns"];

export function CampaignList({
	initialCampaigns,
}: {
	initialCampaigns: Campaigns;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const campaigns = useQuery({
		...trpc.gtm.campaigns.queryOptions(),
		initialData: initialCampaigns,
	});
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const create = useMutation(
		trpc.gtm.createCampaign.mutationOptions({
			onSuccess: async () => {
				setName("");
				setDescription("");
				await queryClient.invalidateQueries({
					queryKey: trpc.gtm.campaigns.pathKey(),
				});
				toast.success("Campaign plan created.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<div className="space-y-6">
			<form
				className="space-y-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault();
					create.mutate({
						name: name.trim(),
						description: description.trim() || null,
					});
				}}
			>
				<h2 className="font-medium">New India campaign</h2>
				<div className="space-y-2">
					<Label htmlFor="campaign-name">Campaign name</Label>
					<Input
						id="campaign-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Filo Storage · India BFSI"
						minLength={3}
						maxLength={120}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="campaign-description">Campaign brief</Label>
					<Textarea
						id="campaign-description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="Who this campaign serves and what evidence it needs."
						maxLength={1000}
						rows={3}
					/>
				</div>
				<Button type="submit" disabled={create.isPending}>
					{create.isPending ? "Creating…" : "Create campaign"}
				</Button>
			</form>
			<div className="space-y-3">
				<h2 className="font-medium">Campaign plans</h2>
				{campaigns.data?.length ? (
					campaigns.data.map((campaign) => (
						<Link
							key={campaign.id}
							href={workspaceUrl(`/outreach/campaigns/${campaign.id}`)}
							className="block rounded-lg border bg-card p-5 hover:bg-muted/50"
						>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h3 className="font-medium">{campaign.name}</h3>
								<Badge variant="outline">
									{campaign.status === "READY"
										? "Research and drafts active"
										: campaign.status === "PAUSED"
											? "Paused"
											: "Draft plan"}
								</Badge>
							</div>
							{campaign.description ? (
								<p className="mt-2 text-muted-foreground text-sm">
									{campaign.description}
								</p>
							) : null}
							<p className="mt-3 text-muted-foreground text-sm">
								{campaign.targetCount}{" "}
								{campaign.targetCount === 1 ? "target" : "targets"} ·{" "}
								{campaign.qualifiedCount} meet gate · {campaign.stepCount} email
								steps · India
							</p>
						</Link>
					))
				) : (
					<div className="rounded-lg border border-dashed p-6 text-sm">
						No campaigns exist yet.
					</div>
				)}
			</div>
		</div>
	);
}
