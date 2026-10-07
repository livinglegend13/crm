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
import { CampaignCallPrep } from "./campaign-call-prep";
import { GTM_VIEW } from "./gtm-config";

type Campaign = RouterOutputs["gtm"]["campaign"];
type WorkflowAgents = RouterOutputs["gtm"]["workflowAgents"];
type Step = {
	id: string;
	delayDays: number;
	subjectPrompt: string;
	bodyPrompt: string;
};

const days = [
	{ id: 1, label: "Mon" },
	{ id: 2, label: "Tue" },
	{ id: 3, label: "Wed" },
	{ id: 4, label: "Thu" },
	{ id: 5, label: "Fri" },
	{ id: 6, label: "Sat" },
	{ id: 7, label: "Sun" },
] as const;

function clockOf(minutes: number) {
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function minutesOf(value: string) {
	const [hours, minutes] = value.split(":").map(Number);
	return (hours ?? 0) * 60 + (minutes ?? 0);
}

function moveWorkflowAgent(ids: string[], index: number, offset: number) {
	const other = index + offset;
	if (other < 0 || other >= ids.length) return ids;
	const next = [...ids];
	const current = next[index];
	const adjacent = next[other];
	if (!current || !adjacent) return ids;
	next[index] = adjacent;
	next[other] = current;
	return next;
}

export function CampaignEditor({
	initialCampaign,
	workflowAgents,
}: {
	initialCampaign: Campaign;
	workflowAgents: WorkflowAgents;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const campaign = useQuery({
		...trpc.gtm.campaign.queryOptions({ id: initialCampaign.id }),
		initialData: initialCampaign,
		refetchInterval: (query) =>
			query.state.data?.targets.some((target) =>
				target.agentRuns.some((run) =>
					["QUEUED", "RUNNING", "WAITING_FOR_APPROVAL"].includes(run.status),
				),
			)
				? GTM_VIEW.poll.activeMs
				: query.state.data?.status === "READY"
					? GTM_VIEW.poll.readyMs
					: false,
	});
	const row = campaign.data ?? initialCampaign;
	const [name, setName] = useState(row.name);
	const [serviceLine, setServiceLine] = useState(row.serviceLine);
	const [description, setDescription] = useState(row.description ?? "");
	const [sourceMaterial, setSourceMaterial] = useState(
		row.sourceMaterial ?? "",
	);
	const [status, setStatus] = useState<Campaign["status"]>(row.status);
	const [workflowAgentIds, setWorkflowAgentIds] = useState(
		row.workflowAgentIds,
	);
	const [sendDays, setSendDays] = useState(row.schedule.sendDays);
	const [start, setStart] = useState(clockOf(row.schedule.startMinute));
	const [end, setEnd] = useState(clockOf(row.schedule.endMinute));
	const [steps, setSteps] = useState<Step[]>(
		row.steps.map((step) => ({
			id: step.id,
			delayDays: step.delayDays,
			subjectPrompt: step.subjectPrompt,
			bodyPrompt: step.bodyPrompt,
		})),
	);
	const [queuedTargetId, setQueuedTargetId] = useState<string | null>(null);
	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: trpc.gtm.campaign.pathKey() }),
			queryClient.invalidateQueries({ queryKey: trpc.gtm.campaigns.pathKey() }),
			queryClient.invalidateQueries({ queryKey: trpc.gtm.insights.pathKey() }),
		]);
	};
	const update = useMutation(
		trpc.gtm.updateCampaign.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Campaign plan saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const saveSteps = useMutation(
		trpc.gtm.saveSteps.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Sequence plan saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeTarget = useMutation(
		trpc.gtm.removeTarget.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Target removed from this campaign.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const runTargetAgent = useMutation(
		trpc.gtm.runTargetAgent.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setQueuedTargetId(null);
				toast.success("Agent run queued. Output appears beside this target.");
			},
			onError: (error) => {
				setQueuedTargetId(null);
				toast.error(error.message);
			},
		}),
	);
	return (
		<div className="space-y-6">
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Sales handoff</h2>
				<ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
					<li className="rounded-md border p-3">
						<strong className="block">1. Research</strong>
						<span className="text-muted-foreground">
							Company agent · automatic
						</span>
					</li>
					<li className="rounded-md border p-3">
						<strong className="block">2. Prepare a call</strong>
						<span className="text-muted-foreground">
							Rep review and reminder · manual
						</span>
					</li>
					<li className="rounded-md border p-3">
						<strong className="block">3. Draft and follow up</strong>
						<span className="text-muted-foreground">
							Outbound agent · approval required
						</span>
					</li>
				</ol>
				<div className="mt-4 space-y-3">
					<h3 className="font-medium text-sm">Advisory agent sequence</h3>
					<p className="text-muted-foreground text-sm">
						These agents run in order after company research. Outreach waits for
						every stage to succeed. Each stage writes a run summary only.
					</p>
					{workflowAgentIds.map((id, index) => (
						<div
							key={id}
							className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
						>
							<span className="min-w-0 flex-1">
								{index + 1}.{" "}
								{workflowAgents.find((agent) => agent.id === id)?.name ?? id}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={index === 0 || row.status === "READY"}
								onClick={() => {
									setWorkflowAgentIds(
										moveWorkflowAgent(workflowAgentIds, index, -1),
									);
								}}
							>
								Earlier
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={
									index === workflowAgentIds.length - 1 ||
									row.status === "READY"
								}
								onClick={() => {
									setWorkflowAgentIds(
										moveWorkflowAgent(workflowAgentIds, index, 1),
									);
								}}
							>
								Later
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={row.status === "READY"}
								onClick={() =>
									setWorkflowAgentIds(
										workflowAgentIds.filter((entry) => entry !== id),
									)
								}
							>
								Remove
							</Button>
						</div>
					))}
					<Select
						value=""
						onValueChange={(id) =>
							setWorkflowAgentIds([...workflowAgentIds, id])
						}
						disabled={
							row.status === "READY" ||
							workflowAgentIds.length >= workflowAgents.length
						}
					>
						<SelectTrigger aria-label="Add advisory agent">
							<SelectValue placeholder="Add advisory agent" />
						</SelectTrigger>
						<SelectContent>
							{workflowAgents
								.filter((agent) => !workflowAgentIds.includes(agent.id))
								.map((agent) => (
									<SelectItem key={agent.id} value={agent.id}>
										{agent.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						Save this sequence with the plan. Pause a Ready campaign before
						changing its agents.
					</p>
				</div>
			</section>
			<section className="rounded-lg border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-medium">Plan and work window</h2>
					<Badge variant="outline">
						{row.status === "READY"
							? "Automatic research and drafts active"
							: row.status === "PAUSED"
								? "Paused"
								: "Draft plan"}
					</Badge>
				</div>
				<p className="mt-2 text-muted-foreground text-sm">
					Time zone: Asia/Kolkata. Ready plans run research and create drafts
					during this window. Every email needs individual approval.
				</p>
				<form
					className="mt-4 space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						update.mutate({
							id: row.id,
							name: name.trim(),
							serviceLine,
							workflowAgentIds,
							description: description.trim() || null,
							sourceMaterial: sourceMaterial.trim() || null,
							status,
							schedule: {
								timeZone: "Asia/Kolkata",
								sendDays,
								startMinute: minutesOf(start),
								endMinute: minutesOf(end),
							},
						});
					}}
				>
					<div className="space-y-2">
						<Label htmlFor="edit-campaign-service">Service</Label>
						<Select
							value={serviceLine}
							onValueChange={(value: Campaign["serviceLine"]) =>
								setServiceLine(value)
							}
						>
							<SelectTrigger id="edit-campaign-service">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="FILO_STORAGE">Filo storage</SelectItem>
								<SelectItem value="CYBERSECURITY">Cybersecurity</SelectItem>
								<SelectItem value="AI">AI services</SelectItem>
								<SelectItem value="FINOPS">FinOps</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-campaign-name">Name</Label>
						<Input
							id="edit-campaign-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							minLength={3}
							maxLength={120}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-campaign-description">Brief</Label>
						<Textarea
							id="edit-campaign-description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							rows={3}
							maxLength={3000}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-campaign-material">Source material</Label>
						{row.sourceFileName ? (
							<p className="text-xs text-muted-foreground">
								Uploaded from {row.sourceFileName}
							</p>
						) : null}
						<Textarea
							id="edit-campaign-material"
							value={sourceMaterial}
							onChange={(event) => setSourceMaterial(event.target.value)}
							rows={8}
							maxLength={GTM_VIEW.material.maxCharacters}
							placeholder="Add verified product notes and supporting material."
						/>
						<p className="text-xs text-muted-foreground">
							Agent drafts use this source. Verify claims before sending.
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="campaign-status">Status</Label>
							<Select
								value={status}
								onValueChange={(value: Campaign["status"]) => setStatus(value)}
							>
								<SelectTrigger id="campaign-status">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="DRAFT">Draft plan</SelectItem>
									<SelectItem value="READY">
										Run research and draft automatically
									</SelectItem>
									<SelectItem value="PAUSED">Paused</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="window-start">Window start</Label>
							<Input
								id="window-start"
								type="time"
								value={start}
								onChange={(event) => setStart(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="window-end">Window end</Label>
							<Input
								id="window-end"
								type="time"
								value={end}
								onChange={(event) => setEnd(event.target.value)}
							/>
						</div>
					</div>
					<fieldset className="space-y-2">
						<legend className="text-sm font-medium">Allowed days</legend>
						<div className="flex flex-wrap gap-2">
							{days.map((day) => (
								<label key={day.id} className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={sendDays.includes(day.id)}
										onChange={(event) =>
											setSendDays(
												event.target.checked
													? [...sendDays, day.id].sort()
													: sendDays.filter((value) => value !== day.id),
											)
										}
									/>
									{day.label}
								</label>
							))}
						</div>
					</fieldset>
					<Button
						type="submit"
						disabled={update.isPending || sendDays.length === 0}
					>
						{update.isPending ? "Saving…" : "Save plan"}
					</Button>
				</form>
			</section>
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Email sequence instructions</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Define up to five steps. Ready plans create first-step drafts during
					the selected India work window. Every draft needs approval.
				</p>
				<div className="mt-4 space-y-4">
					{steps.map((step, index) => (
						<div key={step.id} className="space-y-3 rounded-lg border p-4">
							<div className="flex items-center justify-between gap-3">
								<h3 className="font-medium text-sm">Step {index + 1}</h3>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setSteps(steps.filter((_, position) => position !== index))
									}
								>
									Remove
								</Button>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`step-delay-${index}`}>
									Days after previous step
								</Label>
								<Input
									id={`step-delay-${index}`}
									type="number"
									min="0"
									max="90"
									value={step.delayDays}
									onChange={(event) =>
										setSteps(
											steps.map((current, position) =>
												position === index
													? {
															...current,
															delayDays: Number(event.target.value),
														}
													: current,
											),
										)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`step-subject-${index}`}>
									Subject guidance
								</Label>
								<Input
									id={`step-subject-${index}`}
									value={step.subjectPrompt}
									onChange={(event) =>
										setSteps(
											steps.map((current, position) =>
												position === index
													? { ...current, subjectPrompt: event.target.value }
													: current,
											),
										)
									}
									maxLength={500}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`step-body-${index}`}>Message guidance</Label>
								<Textarea
									id={`step-body-${index}`}
									value={step.bodyPrompt}
									onChange={(event) =>
										setSteps(
											steps.map((current, position) =>
												position === index
													? { ...current, bodyPrompt: event.target.value }
													: current,
											),
										)
									}
									rows={3}
									maxLength={3000}
								/>
							</div>
						</div>
					))}
					<div className="flex flex-wrap gap-3">
						<Button
							variant="outline"
							disabled={steps.length >= 5}
							onClick={() =>
								setSteps([
									...steps,
									{
										id: crypto.randomUUID(),
										delayDays: steps.length ? 3 : 0,
										subjectPrompt: "",
										bodyPrompt: "",
									},
								])
							}
						>
							Add step
						</Button>
						<Button
							disabled={
								saveSteps.isPending ||
								steps.some(
									(step) =>
										step.subjectPrompt.trim().length < 3 ||
										step.bodyPrompt.trim().length < 3,
								)
							}
							onClick={() => saveSteps.mutate({ id: row.id, steps })}
						>
							{saveSteps.isPending ? "Saving…" : "Save sequence"}
						</Button>
					</div>
				</div>
			</section>
			<section className="rounded-lg border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-medium">Targets ({row.targets.length})</h2>
					<Button asChild variant="outline" size="sm">
						<Link href={workspaceUrl("/outreach/prospects")}>
							Find prospects
						</Link>
					</Button>
				</div>
				{row.targets.length ? (
					<div className="mt-4 space-y-3">
						{row.targets.map((target) => (
							<div key={target.id} className="rounded-lg border p-3">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<p className="font-medium text-sm">{target.companyName}</p>
										<p className="text-muted-foreground text-xs">
											{target.contactName ?? "Buyer contact needed"} ·{" "}
											{row.serviceLine !== "FILO_STORAGE"
												? "Service fit needs research"
												: target.decision === "MEETS_GATE"
													? "Meets gate"
													: target.decision === "BELOW_GATE"
														? "Below gate"
														: "Evidence needed"}
										</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										disabled={removeTarget.isPending}
										onClick={() =>
											removeTarget.mutate({ id: row.id, targetId: target.id })
										}
									>
										Remove
									</Button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={runTargetAgent.isPending}
										onClick={() => {
											setQueuedTargetId(target.id);
											runTargetAgent.mutate({
												id: row.id,
												targetId: target.id,
												agentId: "terraeagle-sales-company",
												clientRequestId: crypto.randomUUID(),
											});
										}}
									>
										{queuedTargetId === target.id
											? "Queueing…"
											: "Research company"}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={
											runTargetAgent.isPending ||
											!target.contactEmail ||
											row.steps.length === 0
										}
										onClick={() => {
											setQueuedTargetId(target.id);
											runTargetAgent.mutate({
												id: row.id,
												targetId: target.id,
												agentId: "terraeagle-sales-outbound-strategist",
												clientRequestId: crypto.randomUUID(),
											});
										}}
									>
										Draft outreach
									</Button>
								</div>
								{!target.contactEmail || row.steps.length === 0 ? (
									<p className="mt-2 text-muted-foreground text-xs">
										Choose a buyer contact and save a sequence step to draft
										outreach.
									</p>
								) : null}
								<CampaignCallPrep
									key={`${target.id}-${target.agentRuns.find((run) => run.agentId === "terraeagle-sales-company" && run.status === "SUCCEEDED")?.id ?? "pending"}`}
									campaignId={row.id}
									targetId={target.id}
									companyId={target.companyId}
									companyName={target.companyName}
									contactId={target.contactId}
									contactName={target.contactName}
									researchSummary={
										target.agentRuns.find(
											(run) =>
												run.agentId === "terraeagle-sales-company" &&
												run.status === "SUCCEEDED",
										)?.summary ?? null
									}
									serviceLine={row.serviceLine}
								/>
								{target.agentRuns.map((run) => (
									<details
										key={run.id}
										className="mt-3 rounded-md border p-3 text-sm"
									>
										<summary className="cursor-pointer font-medium">
											{run.agentId === "terraeagle-sales-company"
												? "Company research"
												: run.workflowStageIndex !== null
													? `Advisory ${run.workflowStageIndex + 1}: ${workflowAgents.find((agent) => agent.id === run.agentId)?.name ?? run.agentId}`
													: `Outreach step ${(run.stepPosition ?? 0) + 1}`}{" "}
											· {run.status.toLowerCase().replaceAll("_", " ")}
										</summary>
										{run.errorMessage ? (
											<p className="mt-2 text-destructive">
												{run.errorMessage}
											</p>
										) : null}
										{run.summary ? (
											<p className="mt-2 whitespace-pre-wrap text-muted-foreground">
												{run.summary}
											</p>
										) : null}
										{run.result ? (
											<div className="mt-3 space-y-3">
												{Object.entries(run.result).map(([key, value]) => (
													<div key={key}>
														<h4 className="font-medium">{key}</h4>
														<pre className="mt-1 whitespace-pre-wrap break-words font-sans text-muted-foreground">
															{JSON.stringify(value, null, 2)}
														</pre>
													</div>
												))}
											</div>
										) : null}
										{run.hasDraft ? (
											<Button
												asChild
												size="sm"
												variant="outline"
												className="mt-3"
											>
												<Link href={workspaceUrl(`/outreach?draft=${run.id}`)}>
													Review draft
												</Link>
											</Button>
										) : null}
									</details>
								))}
							</div>
						))}
					</div>
				) : (
					<p className="mt-4 text-muted-foreground text-sm">
						Add India companies from Prospecting.
					</p>
				)}
			</section>
		</div>
	);
}
