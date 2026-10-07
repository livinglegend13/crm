"use client";

import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

const QUESTIONS = {
	FILO_STORAGE:
		"How do you measure average stored capacity across the last 12 months? What storage cost or recovery problem needs attention?",
	CYBERSECURITY:
		"Which security outcome needs improvement? Who owns the current process and evaluation?",
	AI: "Which workflow takes the most manual effort? What result would make an AI pilot useful?",
	FINOPS:
		"Which cloud spend category needs attention? How do you measure savings and assign ownership?",
} as const;

export function CampaignCallPrep({
	companyId,
	companyName,
	contactId,
	contactName,
	researchSummary,
	serviceLine,
	targetId,
}: {
	companyId: string;
	companyName: string;
	contactId: string | null;
	contactName: string | null;
	researchSummary: string | null;
	serviceLine: keyof typeof QUESTIONS;
	targetId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [dueAt, setDueAt] = useState("");
	const [script, setScript] = useState(
		`Research cues to verify:\n${researchSummary?.slice(0, 1500) ?? "No research run is available. Review the account before calling."}\n\nOpening: I am calling from Terraeagle. Is now a good time for a short question?\nDiscovery: ${QUESTIONS[serviceLine]}\nClose: Agree on one next step and record the answer.`,
	);
	const [created, setCreated] = useState(false);
	const create = useMutation(
		trpc.activities.create.mutationOptions({
			onSuccess: async () => {
				setCreated(true);
				await queryClient.invalidateQueries({
					queryKey: trpc.activities.myTasks.pathKey(),
				});
				toast.success("Call reminder added to My Tasks.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<details className="mt-3 rounded-md border p-3 text-sm">
			<summary className="cursor-pointer font-medium">Prepare a call</summary>
			<p className="mt-2 text-muted-foreground">
				Review the research cues. The CRM creates a task for your call. It does
				not place calls.
			</p>
			{researchSummary ? null : (
				<p className="mt-2 text-muted-foreground">
					Run company research before preparing this call.
				</p>
			)}
			<div className="mt-3 space-y-3">
				<div className="space-y-2">
					<Label htmlFor={`call-due-${targetId}`}>Call reminder</Label>
					<Input
						id={`call-due-${targetId}`}
						type="datetime-local"
						value={dueAt}
						onChange={(event) => setDueAt(event.target.value)}
						disabled={created}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`call-script-${targetId}`}>
						Call cues and script
					</Label>
					<Textarea
						id={`call-script-${targetId}`}
						value={script}
						onChange={(event) => setScript(event.target.value)}
						rows={8}
						maxLength={3000}
						disabled={created}
					/>
				</div>
				{created ? (
					<Link href={workspaceUrl("/")} className="text-primary underline">
						Open My Tasks
					</Link>
				) : (
					<Button
						size="sm"
						disabled={
							!researchSummary || !dueAt || !script.trim() || create.isPending
						}
						onClick={() => {
							const date = new Date(dueAt);
							if (Number.isNaN(date.getTime()) || date <= new Date()) {
								toast.error("Choose a future time for the call.");
								return;
							}
							create.mutate({
								type: "TASK",
								subject: `Call ${contactName ?? companyName} about ${companyName}`,
								body: script.trim(),
								dueAt: date.toISOString(),
								companyId,
								contactId: contactId ?? undefined,
							});
						}}
					>
						{create.isPending ? "Saving…" : "Create call reminder"}
					</Button>
				)}
			</div>
		</details>
	);
}
