"use client";

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

type Drafts = RouterOutputs["outreachDrafts"]["list"];
type Draft = Drafts[number];

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
	});
	const rows = drafts.data ?? initialDrafts;
	const [selectedId, setSelectedId] = useState<string | null>(
		selectedRunId ?? null,
	);
	const selected = rows.find((draft) => draft.runId === selectedId) ?? rows[0];

	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-6 text-sm">
				No outreach drafts exist yet. Run the Filo Outreach Draft Assistant for
				an approved contact.
			</div>
		);
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
			<nav aria-label="Outreach drafts" className="flex flex-col gap-2">
				{rows.map((draft) => (
					<button
						key={draft.runId}
						type="button"
						onClick={() => setSelectedId(draft.runId)}
						aria-current={draft.runId === selected?.runId ? "true" : undefined}
						className={`rounded-lg border p-4 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 ${draft.runId === selected?.runId ? "bg-muted" : ""}`}
					>
						<span className="block truncate font-medium text-sm">
							{draft.subject}
						</span>
						<span className="mt-1 block text-muted-foreground text-xs">
							{draft.recipientEmail || "Recipient needed"}
						</span>
					</button>
				))}
			</nav>
			{selected ? <DraftEditor key={selected.runId} draft={selected} /> : null}
		</div>
	);
}

function DraftEditor({ draft }: { draft: Draft }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [recipientEmail, setRecipientEmail] = useState(
		draft.recipientEmail ?? "",
	);
	const [subject, setSubject] = useState(draft.subject);
	const [body, setBody] = useState(draft.body);
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
	const changed =
		recipientEmail !== (draft.recipientEmail ?? "") ||
		subject !== draft.subject ||
		body !== draft.body;

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate({ runId: draft.runId, recipientEmail, subject, body });
			}}
			className="flex min-w-0 flex-col gap-5 rounded-lg border bg-card p-5"
		>
			<div>
				<h2 className="font-medium text-base">Edit draft</h2>
				<p className="mt-1 text-muted-foreground text-xs">
					{draft.agentName} · Created{" "}
					{new Date(draft.createdAt).toLocaleString("en-IN")}
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="draft-recipient">Recipient email</Label>
				<Input
					id="draft-recipient"
					type="email"
					value={recipientEmail}
					onChange={(event) => setRecipientEmail(event.target.value)}
					placeholder="name@company.com"
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="draft-subject">Subject</Label>
				<Input
					id="draft-subject"
					value={subject}
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
					onChange={(event) => setBody(event.target.value)}
					required
					maxLength={20_000}
					rows={16}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" disabled={!changed || save.isPending}>
					{save.isPending ? "Saving…" : "Save draft"}
				</Button>
				<Link
					href={workspaceUrl(`/agents/${draft.agentId}`)}
					className="text-primary text-sm hover:underline"
				>
					View agent run
				</Link>
			</div>
			<p className="text-muted-foreground text-xs">
				Saving keeps this draft in the CRM. No email is sent.
			</p>
		</form>
	);
}
