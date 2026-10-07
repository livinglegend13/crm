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

type Campaign = RouterOutputs["gtm"]["campaign"];
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

export function CampaignEditor({
	initialCampaign,
}: {
	initialCampaign: Campaign;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const campaign = useQuery({
		...trpc.gtm.campaign.queryOptions({ id: initialCampaign.id }),
		initialData: initialCampaign,
	});
	const row = campaign.data ?? initialCampaign;
	const [name, setName] = useState(row.name);
	const [description, setDescription] = useState(row.description ?? "");
	const [status, setStatus] = useState<Campaign["status"]>(row.status);
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
	return (
		<div className="space-y-6">
			<section className="rounded-lg border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-medium">Plan and sending window</h2>
					<Badge variant="outline">
						{row.status === "READY"
							? "Plan ready"
							: row.status === "PAUSED"
								? "Paused"
								: "Draft plan"}
					</Badge>
				</div>
				<p className="mt-2 text-muted-foreground text-sm">
					Time zone: Asia/Kolkata. This window guides future sending. Current
					sends still require individual approval.
				</p>
				<form
					className="mt-4 space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						update.mutate({
							id: row.id,
							name: name.trim(),
							description: description.trim() || null,
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
							maxLength={1000}
						/>
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
									<SelectItem value="READY">Plan ready</SelectItem>
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
					Define up to five steps. These instructions do not create or send
					drafts automatically.
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
							<div
								key={target.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
							>
								<div>
									<p className="font-medium text-sm">{target.companyName}</p>
									<p className="text-muted-foreground text-xs">
										{target.contactName ?? "Buyer contact needed"} ·{" "}
										{target.decision === "MEETS_GATE"
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
