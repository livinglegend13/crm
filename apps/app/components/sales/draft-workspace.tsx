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

type Drafts = RouterOutputs["outreachDrafts"]["list"];
type Draft = Drafts[number];
type Senders = RouterOutputs["outreachDrafts"]["senders"];

export function DraftWorkspace({
	initialDrafts,
	selectedRunId,
}: {
	initialDrafts: Drafts;
	selectedRunId?: string;
}) {
	const trpc = useTRPC();
	const drafts = useQuery({
		...trpc.outreachDrafts.list.queryOptions(),
		initialData: initialDrafts,
		refetchInterval: 10_000,
	});
	const rows = drafts.data ?? initialDrafts;
	const senders = useQuery(trpc.outreachDrafts.senders.queryOptions());
	const [selectedId, setSelectedId] = useState<string | null>(
		selectedRunId ?? null,
	);
	const selected = rows.find((draft) => draft.runId === selectedId) ?? rows[0];

	if (rows.length === 0) {
		return (
			<div className="flex flex-col gap-6">
				<MailboxConnections status={senders.data} />
				<div className="rounded-lg border border-dashed p-6 text-sm">
					No outreach drafts exist yet. Run the Filo Outreach Draft Assistant
					for an approved contact.
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<MailboxConnections status={senders.data} />
			<div className="grid gap-6 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
				<nav aria-label="Outreach drafts" className="flex flex-col gap-2">
					{rows.map((draft) => (
						<button
							key={draft.runId}
							type="button"
							onClick={() => setSelectedId(draft.runId)}
							aria-current={
								draft.runId === selected?.runId ? "true" : undefined
							}
							className={`rounded-lg border p-4 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 ${draft.runId === selected?.runId ? "bg-muted" : ""}`}
						>
							<span className="block truncate font-medium text-sm">
								{draft.subject}
							</span>
							<span className="mt-1 block text-muted-foreground text-xs">
								{draft.recipientEmail || "Recipient needed"} ·{" "}
								{draft.status === "SENT"
									? "Sent"
									: draft.status === "SENDING"
										? "Sending"
										: draft.status === "SEND_UNKNOWN"
											? "Check Sent Items"
											: draft.status === "APPROVED"
												? "Approved"
												: "Needs approval"}
							</span>
						</button>
					))}
				</nav>
				{selected ? (
					<DraftEditor
						key={selected.runId}
						draft={selected}
						senders={senders.data?.addresses ?? []}
						canSend={senders.data?.connected ?? false}
						recommendedSender={senders.data?.recommendedSender ?? null}
						senderReason={senders.data?.reason ?? null}
					/>
				) : null}
			</div>
		</div>
	);
}

function MailboxConnections({ status }: { status: Senders | undefined }) {
	const workspaceUrl = useWorkspaceUrl();
	return (
		<section className="rounded-lg border bg-card p-5 text-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-medium">Sender mailboxes</h2>
					<p className="mt-1 text-muted-foreground text-xs">
						{status
							? `${status.mailboxes.length} configured · Sending ${status.connected ? "connected" : "not connected"} · Inbox ${status.readConnected ? "connected" : "not connected"}`
							: "Checking Microsoft 365 access…"}
					</p>
					{status ? (
						<p className="mt-1 text-muted-foreground text-xs">
							Reply alerts:{" "}
							{status.replyAlertsEnabled ? "On" : "Paused for DKIM"} ·{" "}
							{status.pendingReplyAlerts} pending · {status.unknownReplyAlerts}{" "}
							need review
						</p>
					) : null}
				</div>
				<Link
					href={workspaceUrl("/settings/connections/microsoft")}
					className="text-primary text-sm hover:underline"
				>
					Manage Microsoft connection
				</Link>
			</div>
			{status?.mailboxes.length ? (
				<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{status.mailboxes.map((mailbox) => (
						<div key={mailbox.address} className="rounded-md border p-3">
							<p className="truncate font-medium text-xs">{mailbox.address}</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{mailbox.status ?? "Waiting for consent"}
								{mailbox.lastSyncedAt
									? ` · ${new Date(mailbox.lastSyncedAt).toLocaleString("en-IN")}`
									: ""}
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{mailbox.sentLast24Hours}/{status.rotation.maxPerMailboxPerDay}{" "}
								sends in 24 hours ·{" "}
								{mailbox.available ? "Available" : "Cooling down"}
							</p>
							{mailbox.lastError ? (
								<p className="mt-1 text-destructive text-xs">
									{mailbox.lastError}
								</p>
							) : null}
						</div>
					))}
				</div>
			) : null}
		</section>
	);
}

function DraftEditor({
	draft,
	senders,
	canSend,
	senderReason,
	recommendedSender,
}: {
	draft: Draft;
	senders: string[];
	canSend: boolean;
	senderReason: string | null;
	recommendedSender: string | null;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [recipientEmail, setRecipientEmail] = useState(
		draft.recipientEmail ?? "",
	);
	const [subject, setSubject] = useState(draft.subject);
	const [body, setBody] = useState(draft.body);
	const [senderEmail, setSenderEmail] = useState(draft.senderEmail ?? "");
	const effectiveSenderEmail = senderEmail || recommendedSender || "";
	const [pointers, setPointers] = useState("");
	const save = useMutation(
		trpc.outreachDrafts.save.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.outreachDrafts.list.pathKey(),
				});
				toast.success("Draft saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const approve = useMutation(
		trpc.outreachDrafts.approve.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.outreachDrafts.list.pathKey(),
				});
				toast.success("Draft approved. No email was sent.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const send = useMutation(
		trpc.outreachDrafts.send.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.outreachDrafts.list.pathKey(),
				});
				if (result.status === "SENT")
					toast.success("Microsoft accepted the email.");
				else
					toast.error(result.error ?? "Microsoft did not confirm this send.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const regenerate = useMutation(
		trpc.outreachDrafts.regenerate.mutationOptions({
			onSuccess: () => {
				setPointers("");
				toast.success(
					"Revision queued. The new draft appears here after the agent finishes.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const changed =
		recipientEmail !== (draft.recipientEmail ?? "") ||
		subject !== draft.subject ||
		body !== draft.body ||
		effectiveSenderEmail !== (draft.senderEmail ?? "");
	const locked = ["SENDING", "SENT", "SEND_UNKNOWN"].includes(draft.status);

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate({
					runId: draft.runId,
					recipientEmail,
					subject,
					body,
					senderEmail: effectiveSenderEmail || null,
				});
			}}
			className="flex min-w-0 flex-col gap-5 rounded-lg border bg-card p-5"
		>
			<div>
				<div className="flex items-center gap-2">
					<h2 className="font-medium text-base">Review email</h2>
					<Badge variant="outline">
						{draft.status === "SEND_UNKNOWN"
							? "Check Sent Items"
							: draft.status === "SENDING"
								? "Sending"
								: draft.status === "SENT"
									? "Sent"
									: draft.status === "APPROVED"
										? "Approved"
										: "Needs approval"}
					</Badge>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					{draft.agentName} · Created{" "}
					{new Date(draft.createdAt).toLocaleString("en-IN")}
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="draft-sender">Sender mailbox</Label>
				<Select
					value={effectiveSenderEmail}
					onValueChange={setSenderEmail}
					disabled={locked}
				>
					<SelectTrigger id="draft-sender" className="w-full">
						<SelectValue placeholder="Choose a sender" />
					</SelectTrigger>
					<SelectContent>
						{senders.map((address) => (
							<SelectItem key={address} value={address}>
								{address}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{senderReason ? (
					<p className="text-muted-foreground text-xs">{senderReason}</p>
				) : null}
				{recommendedSender ? (
					<p className="text-muted-foreground text-xs">
						Suggested by rotation: {recommendedSender}. Each mailbox has 10
						sends per 24 hours and a 15-minute gap.
					</p>
				) : null}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="draft-recipient">Recipient email</Label>
				<Input
					id="draft-recipient"
					type="email"
					value={recipientEmail}
					disabled={locked}
					onChange={(event) => setRecipientEmail(event.target.value)}
					placeholder="name@company.com"
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="draft-subject">Subject</Label>
				<Input
					id="draft-subject"
					value={subject}
					disabled={locked}
					onChange={(event) => setSubject(event.target.value)}
					required
					maxLength={300}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="draft-body">Message</Label>
				<Textarea
					id="draft-body"
					value={body}
					disabled={locked}
					onChange={(event) => setBody(event.target.value)}
					required
					maxLength={20_000}
					rows={16}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" disabled={!changed || save.isPending || locked}>
					{save.isPending ? "Saving…" : "Save draft"}
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={
						changed ||
						draft.status === "APPROVED" ||
						locked ||
						approve.isPending ||
						!draft.updatedAt
					}
					onClick={() => {
						if (draft.updatedAt)
							approve.mutate({
								runId: draft.runId,
								expectedUpdatedAt: draft.updatedAt,
							});
					}}
				>
					{approve.isPending ? "Approving…" : "Approve draft"}
				</Button>
				{draft.status === "APPROVED" && !changed ? (
					<Button
						type="button"
						disabled={!canSend || send.isPending || !draft.updatedAt}
						onClick={() => {
							if (draft.updatedAt)
								send.mutate({
									runId: draft.runId,
									expectedUpdatedAt: draft.updatedAt,
								});
						}}
					>
						{send.isPending ? "Sending…" : "Send approved email"}
					</Button>
				) : null}
				{draft.status === "APPROVED" && !changed ? (
					<Button
						type="button"
						variant="outline"
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(
									`To: ${draft.recipientEmail}\nSubject: ${draft.subject}\n\n${draft.body}`,
								);
								toast.success("Approved email copied for Outlook.");
							} catch {
								toast.error("Could not copy the email.");
							}
						}}
					>
						Copy for Outlook
					</Button>
				) : null}
				<Link
					href={workspaceUrl(`/agents/${draft.agentId}`)}
					className="text-primary text-sm hover:underline"
				>
					View agent run
				</Link>
			</div>
			<p className="text-muted-foreground text-xs">
				Save your edits before approval. Editing an approved email removes its
				approval. Sending requires a separate click. Microsoft accepts the
				message before it appears in Sent Items.
			</p>
			{draft.sendError ? (
				<p role="alert" className="text-destructive text-sm">
					{draft.sendError}
				</p>
			) : null}
			<section className="rounded-lg border p-4">
				<h3 className="font-medium text-sm">Regenerate with pointers</h3>
				<p className="mt-1 text-muted-foreground text-xs">
					The agent creates a separate draft. This draft stays unchanged.
				</p>
				<Textarea
					aria-label="Revision pointers"
					className="mt-3"
					value={pointers}
					onChange={(event) => setPointers(event.target.value)}
					placeholder="For example: shorten the introduction and focus on verified storage costs."
					maxLength={3000}
					rows={4}
				/>
				<Button
					className="mt-3"
					type="button"
					variant="outline"
					disabled={
						changed || pointers.trim().length < 3 || regenerate.isPending
					}
					onClick={() =>
						regenerate.mutate({
							runId: draft.runId,
							pointers,
							clientRequestId: crypto.randomUUID(),
						})
					}
				>
					{regenerate.isPending ? "Queueing revision…" : "Regenerate draft"}
				</Button>
				{changed ? (
					<p className="mt-2 text-muted-foreground text-xs">
						Save current edits before requesting a revision.
					</p>
				) : null}
			</section>
			<details className="rounded-lg border p-4" open>
				<summary className="cursor-pointer font-medium text-sm">
					Research and source record
				</summary>
				<div className="mt-4 space-y-4 text-sm">
					{[
						["Sources", draft.researchSources],
						["Facts", draft.researchFacts],
						["Unknowns", draft.researchUnknowns],
						["Run summary", draft.researchSummary],
					].map(([label, value]) => (
						<div key={label}>
							<h3 className="font-medium">{label}</h3>
							<p className="mt-1 whitespace-pre-wrap text-muted-foreground">
								{value || "The agent did not provide this information."}
							</p>
						</div>
					))}
				</div>
			</details>
		</form>
	);
}
