"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type FollowUp = RouterOutputs["inbox"]["followUps"][number];
type Filter = "OPEN" | "WAITING" | "REVIEW" | "ALL";

function dueLabel(row: FollowUp) {
	if (!row.dueAt) return "No due date";
	const due = new Date(row.dueAt);
	const label = new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Kolkata",
	}).format(due);
	return `${due < new Date() ? "Overdue" : "Due"} ${label}`;
}

function actionLabel(row: FollowUp) {
	if (row.dismissedAt) return "Done";
	if (row.snoozedUntil && new Date(row.snoozedUntil) > new Date())
		return "Snoozed";
	if (row.owner === "ME") return "Your turn";
	if (row.owner === "CUSTOMER") return "Waiting for customer";
	if (row.owner === "REVIEW") return "Review owner";
	return "No action";
}

function FollowUpCard({ row }: { row: FollowUp }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const url = useWorkspaceUrl();
	const [until, setUntil] = useState("");
	const action = useMutation(
		trpc.inbox.followUpAction.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.inbox.followUps.queryKey(),
				});
				toast.success("Follow-up updated.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<article className="rounded-lg border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<Link
						href={url(`/inbox?thread=${encodeURIComponent(row.threadId)}`)}
						className="font-medium text-sm hover:underline"
					>
						{row.subject || "No subject"}
					</Link>
					<p className="mt-1 text-muted-foreground text-xs">
						{row.contact?.name ||
							row.company?.name ||
							row.lastMessage?.fromEmail}
					</p>
				</div>
				<Badge variant="outline">{actionLabel(row)}</Badge>
			</div>
			<p className="mt-3 text-sm">{row.reason}</p>
			{row.evidenceQuote ? (
				<p className="mt-2 text-muted-foreground text-xs">
					Evidence: “{row.evidenceQuote}”
				</p>
			) : null}
			<p className="mt-2 text-muted-foreground text-xs">
				{dueLabel(row)} ·{" "}
				{row.dueSource === "EXPLICIT" ? "From email" : "Suggested reminder"} ·{" "}
				{row.confidence.toLowerCase()} confidence
			</p>
			<div className="mt-3 flex flex-wrap items-end gap-2">
				{row.lastMessage?.mailboxUrl ? (
					<Button variant="outline" size="sm" asChild>
						<a
							href={row.lastMessage.mailboxUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							Open in Outlook
						</a>
					</Button>
				) : null}
				<Input
					type="datetime-local"
					aria-label={`Reminder time for ${row.subject || "conversation"}`}
					value={until}
					onChange={(event) => setUntil(event.target.value)}
				/>
				<Button
					variant="outline"
					size="sm"
					disabled={!until || action.isPending}
					onClick={() =>
						action.mutate({
							threadId: row.threadId,
							action: "SNOOZE",
							until: new Date(until).toISOString(),
						})
					}
				>
					Snooze
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={action.isPending}
					onClick={() =>
						action.mutate({
							threadId: row.threadId,
							action: row.dismissedAt ? "REOPEN" : "DISMISS",
						})
					}
				>
					{row.dismissedAt ? "Reopen" : "Mark done"}
				</Button>
			</div>
		</article>
	);
}

export function FollowUpQueue({ initialRows }: { initialRows: FollowUp[] }) {
	const trpc = useTRPC();
	const [filter, setFilter] = useState<Filter>("OPEN");
	const { data: rows = initialRows } = useQuery({
		...trpc.inbox.followUps.queryOptions(),
		initialData: initialRows,
		refetchInterval: 60_000,
	});
	const active = rows.filter(
		(row) =>
			!row.dismissedAt &&
			(!row.snoozedUntil || new Date(row.snoozedUntil) <= new Date()),
	);
	const filtered = rows.filter((row) => {
		if (filter === "ALL") return true;
		if (!active.includes(row)) return false;
		if (filter === "OPEN") return row.owner === "ME";
		if (filter === "WAITING") return row.owner === "CUSTOMER";
		return row.owner === "REVIEW";
	});
	const tabs: { id: Filter; label: string; count: number }[] = [
		{
			id: "OPEN",
			label: "Your turn",
			count: active.filter((r) => r.owner === "ME").length,
		},
		{
			id: "WAITING",
			label: "Waiting",
			count: active.filter((r) => r.owner === "CUSTOMER").length,
		},
		{
			id: "REVIEW",
			label: "Review",
			count: active.filter((r) => r.owner === "REVIEW").length,
		},
		{ id: "ALL", label: "All", count: rows.length },
	];
	return (
		<section className="mb-8" aria-label="Follow-up queue">
			<h2 className="font-medium text-base">Follow-up queue</h2>
			<p className="mt-1 text-muted-foreground text-sm">
				Track sent mail and replies from your connected Microsoft mailbox.
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				{tabs.map((tab) => (
					<Button
						key={tab.id}
						variant={filter === tab.id ? "default" : "outline"}
						size="sm"
						onClick={() => setFilter(tab.id)}
					>
						{tab.label} ({tab.count})
					</Button>
				))}
			</div>
			{filtered.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">
					No conversations need action in this view.
				</p>
			) : (
				<div className="mt-4 grid gap-3 lg:grid-cols-2">
					{filtered.map((row) => (
						<FollowUpCard key={row.id} row={row} />
					))}
				</div>
			)}
		</section>
	);
}
