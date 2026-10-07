"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Prospects = RouterOutputs["gtm"]["prospects"];
type Prospect = Prospects["rows"][number];
type Campaigns = RouterOutputs["gtm"]["campaigns"];
type Decision = "ALL" | "EVIDENCE_NEEDED" | "MEETS_GATE" | "BELOW_GATE";

function decisionLabel(value: Decision) {
	return {
		ALL: "All decisions",
		EVIDENCE_NEEDED: "Evidence needed",
		MEETS_GATE: "Meets 1 PB gate",
		BELOW_GATE: "Below 1 PB gate",
	}[value];
}

export function ProspectBoard({
	initialProspects,
	initialCampaigns,
}: {
	initialProspects: Prospects;
	initialCampaigns: Campaigns;
}) {
	const trpc = useTRPC();
	const [searchText, setSearchText] = useState("");
	const [q, setQ] = useState("");
	const [decision, setDecision] = useState<Decision>("ALL");
	const [offset, setOffset] = useState(0);
	const [editingId, setEditingId] = useState<string | null>(null);
	const input = { q, decision, offset, limit: 25 };
	const prospects = useQuery({
		...trpc.gtm.prospects.queryOptions(input),
		initialData:
			q === "" && decision === "ALL" && offset === 0
				? initialProspects
				: undefined,
	});
	const campaigns = useQuery({
		...trpc.gtm.campaigns.queryOptions(),
		initialData: initialCampaigns,
	});
	const rows = prospects.data?.rows ?? [];
	return (
		<div className="space-y-6">
			<form
				onSubmit={(event) => {
					event.preventDefault();
					setOffset(0);
					setQ(searchText.trim());
				}}
				className="flex flex-wrap items-end gap-3"
			>
				<div className="min-w-52 flex-1 space-y-2">
					<Label htmlFor="prospect-search">
						Company, industry, or contact email
					</Label>
					<Input
						id="prospect-search"
						value={searchText}
						onChange={(event) => setSearchText(event.target.value)}
						placeholder="Search India prospects"
					/>
				</div>
				<div className="w-52 space-y-2">
					<Label htmlFor="prospect-decision">Qualification</Label>
					<Select
						value={decision}
						onValueChange={(value: Decision) => {
							setDecision(value);
							setOffset(0);
						}}
					>
						<SelectTrigger id="prospect-decision">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(
								["ALL", "EVIDENCE_NEEDED", "MEETS_GATE", "BELOW_GATE"] as const
							).map((value) => (
								<SelectItem key={value} value={value}>
									{decisionLabel(value)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Button type="submit">Search</Button>
			</form>
			<p className="text-muted-foreground text-sm">
				{prospects.data?.total ?? 0} India companies match. No company meets the
				gate without a documented 12-month average.
			</p>
			{rows.length === 0 ? (
				<div className="rounded-lg border border-dashed p-6 text-sm">
					No India companies match these filters.
				</div>
			) : (
				<div className="space-y-3">
					{rows.map((row) => (
						<section
							key={row.companyId}
							className="rounded-lg border bg-card p-5"
						>
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div>
									<h2 className="font-medium">{row.name}</h2>
									<p className="mt-1 text-muted-foreground text-sm">
										{[row.industry, row.city, row.country]
											.filter(Boolean)
											.join(" · ") || "India"}{" "}
										· {row.contactCount} contacts
									</p>
								</div>
								<Badge variant="outline">
									{decisionLabel(row.review?.decision ?? "EVIDENCE_NEEDED")}
								</Badge>
							</div>
							{row.contacts.length ? (
								<p className="mt-3 text-sm">
									{row.contacts
										.map((contact) =>
											[contact.name, contact.title].filter(Boolean).join(" · "),
										)
										.join("; ")}
								</p>
							) : (
								<p className="mt-3 text-muted-foreground text-sm">
									No linked contacts yet.
								</p>
							)}
							{row.review?.evidenceSource ? (
								<p className="mt-2 text-muted-foreground text-sm">
									Evidence: {row.review.evidenceSource}
								</p>
							) : null}
							<div className="mt-4 flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setEditingId(
											editingId === row.companyId ? null : row.companyId,
										)
									}
								>
									{editingId === row.companyId
										? "Close review"
										: "Review evidence"}
								</Button>
								<AddToCampaign row={row} campaigns={campaigns.data ?? []} />
							</div>
							{editingId === row.companyId ? (
								<ReviewEditor key={row.companyId} row={row} />
							) : null}
						</section>
					))}
				</div>
			)}
			<div className="flex items-center justify-between gap-3">
				<Button
					variant="outline"
					disabled={offset === 0}
					onClick={() => setOffset(Math.max(0, offset - 25))}
				>
					Previous
				</Button>
				<span className="text-muted-foreground text-sm">
					{rows.length ? offset + 1 : 0}–{offset + rows.length} of{" "}
					{prospects.data?.total ?? 0}
				</span>
				<Button
					variant="outline"
					disabled={offset + 25 >= (prospects.data?.total ?? 0)}
					onClick={() => setOffset(offset + 25)}
				>
					Next
				</Button>
			</div>
		</div>
	);
}

function AddToCampaign({
	row,
	campaigns,
}: {
	row: Prospect;
	campaigns: Campaigns;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [campaignId, setCampaignId] = useState("");
	const [contactId, setContactId] = useState(
		row.review?.buyerContactId ?? "none",
	);
	const add = useMutation(
		trpc.gtm.addTarget.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.gtm.prospects.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.gtm.campaigns.pathKey(),
					}),
				]);
				toast.success("Prospect added to campaign.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	if (!campaigns.length)
		return (
			<p className="text-muted-foreground text-sm">
				Create a campaign to group prospects.
			</p>
		);
	return (
		<div className="flex flex-wrap gap-2">
			<Select value={campaignId} onValueChange={setCampaignId}>
				<SelectTrigger aria-label={`Campaign for ${row.name}`} className="w-44">
					<SelectValue placeholder="Choose campaign" />
				</SelectTrigger>
				<SelectContent>
					{campaigns.map((campaign) => (
						<SelectItem key={campaign.id} value={campaign.id}>
							{campaign.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select value={contactId} onValueChange={setContactId}>
				<SelectTrigger aria-label={`Contact for ${row.name}`} className="w-44">
					<SelectValue placeholder="Select contact" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="none">Find contact later</SelectItem>
					{row.contacts.map((contact) => (
						<SelectItem key={contact.id} value={contact.id}>
							{contact.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Button
				type="button"
				size="sm"
				disabled={!campaignId || add.isPending}
				onClick={() =>
					add.mutate({
						id: campaignId,
						companyId: row.companyId,
						contactId: contactId === "none" ? null : contactId,
					})
				}
			>
				Add target
			</Button>
		</div>
	);
}

function ReviewEditor({ row }: { row: Prospect }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [decision, setDecision] = useState<Exclude<Decision, "ALL">>(
		row.review?.decision ?? "EVIDENCE_NEEDED",
	);
	const [average, setAverage] = useState(
		row.review?.averageCapacityPb?.toString() ?? "",
	);
	const [periodStart, setPeriodStart] = useState(row.review?.periodStart ?? "");
	const [periodEnd, setPeriodEnd] = useState(row.review?.periodEnd ?? "");
	const [source, setSource] = useState(row.review?.evidenceSource ?? "");
	const [note, setNote] = useState(row.review?.evidenceNote ?? "");
	const [buyerContactId, setBuyerContactId] = useState(
		row.review?.buyerContactId ?? "none",
	);
	const save = useMutation(
		trpc.gtm.saveReview.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.gtm.prospects.pathKey(),
				});
				toast.success("Evidence review saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<form
			className="mt-5 space-y-4 border-t pt-5"
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate({
					companyId: row.companyId,
					decision,
					averageCapacityPb: average ? Number(average) : null,
					periodStart: periodStart || null,
					periodEnd: periodEnd || null,
					evidenceSource: source.trim() || null,
					evidenceNote: note.trim() || null,
					buyerContactId: buyerContactId === "none" ? null : buyerContactId,
				});
			}}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor={`decision-${row.companyId}`}>Decision</Label>
					<Select
						value={decision}
						onValueChange={(value: Exclude<Decision, "ALL">) =>
							setDecision(value)
						}
					>
						<SelectTrigger id={`decision-${row.companyId}`}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(["EVIDENCE_NEEDED", "MEETS_GATE", "BELOW_GATE"] as const).map(
								(value) => (
									<SelectItem key={value} value={value}>
										{decisionLabel(value)}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`average-${row.companyId}`}>
						Average stored capacity (PB)
					</Label>
					<Input
						id={`average-${row.companyId}`}
						type="number"
						min="0"
						step="0.001"
						value={average}
						onChange={(event) => setAverage(event.target.value)}
						placeholder="Verified 12-month average"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`start-${row.companyId}`}>Period start</Label>
					<Input
						id={`start-${row.companyId}`}
						type="date"
						value={periodStart}
						onChange={(event) => setPeriodStart(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`end-${row.companyId}`}>Period end</Label>
					<Input
						id={`end-${row.companyId}`}
						type="date"
						value={periodEnd}
						onChange={(event) => setPeriodEnd(event.target.value)}
					/>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor={`source-${row.companyId}`}>
						Evidence source or report reference
					</Label>
					<Input
						id={`source-${row.companyId}`}
						value={source}
						onChange={(event) => setSource(event.target.value)}
						placeholder="Storage billing report, customer statement, or source URL"
					/>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor={`note-${row.companyId}`}>Research notes</Label>
					<Textarea
						id={`note-${row.companyId}`}
						value={note}
						onChange={(event) => setNote(event.target.value)}
						rows={3}
						placeholder="State what is known and what remains unverified."
					/>
				</div>
			</div>
			<div className="w-64 space-y-2">
				<Label htmlFor={`buyer-${row.companyId}`}>
					Storage or FinOps contact
				</Label>
				<Select value={buyerContactId} onValueChange={setBuyerContactId}>
					<SelectTrigger id={`buyer-${row.companyId}`}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Owner unknown</SelectItem>
						{row.contacts.map((contact) => (
							<SelectItem key={contact.id} value={contact.id}>
								{contact.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<p className="text-muted-foreground text-sm">
				A gate decision needs a documented 12-month average. Annual new data
				does not count.
			</p>
			<div className="flex flex-wrap gap-3">
				<Button type="submit" disabled={save.isPending}>
					{save.isPending ? "Saving…" : "Save review"}
				</Button>
				<Button asChild variant="outline">
					<Link
						href={workspaceUrl(`/companies?record=company:${row.companyId}`)}
					>
						Open company
					</Link>
				</Button>
			</div>
		</form>
	);
}
