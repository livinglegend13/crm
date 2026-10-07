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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { GTM_VIEW } from "./gtm-config";
import { readSalesMaterial } from "./read-sales-material";

type Campaigns = RouterOutputs["gtm"]["campaigns"];

const DRIP_STEPS = [
	{
		delayDays: 0,
		subjectPrompt:
			"Introduce the buyer problem from the supplied material. Use no unverified claim.",
		bodyPrompt:
			"Write a concise first email. Use verified company facts and supported material points. Ask one relevant question. Do not claim prior contact.",
	},
	{
		delayDays: 4,
		subjectPrompt:
			"Follow up with one distinct, verified angle from the material.",
		bodyPrompt:
			"Add one useful insight only after its claim is verified. Avoid repeating the first email. Ask one question.",
	},
	{
		delayDays: 7,
		subjectPrompt: "Close the sequence with a short, relevant question.",
		bodyPrompt:
			"Keep this follow-up brief. Summarize buyer value without unsupported numbers or promises. Offer an easy next step.",
	},
] as const;

export function CampaignList({
	initialCampaigns,
}: {
	initialCampaigns: Campaigns;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const router = useRouter();
	const campaigns = useQuery({
		...trpc.gtm.campaigns.queryOptions(),
		initialData: initialCampaigns,
	});
	const [name, setName] = useState("");
	const [serviceLine, setServiceLine] = useState<
		"FILO_STORAGE" | "CYBERSECURITY" | "AI" | "FINOPS"
	>("FILO_STORAGE");
	const [description, setDescription] = useState("");
	const [material, setMaterial] = useState("");
	const [sourceFileName, setSourceFileName] = useState<string | null>(null);
	const [readingFile, setReadingFile] = useState(false);
	const [planRunId, setPlanRunId] = useState<string | null>(null);
	const [planBriefOverride, setPlanBriefOverride] = useState<string | null>(
		null,
	);
	const requestPlan = useMutation(
		trpc.gtm.requestCampaignPlan.mutationOptions({
			onSuccess: ({ runId }) => {
				setPlanRunId(runId);
				setPlanBriefOverride(null);
				toast.success("Campaign planner started. Its steps appear here.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const planStatus = useQuery({
		...trpc.gtm.campaignPlanStatus.queryOptions({ runId: planRunId ?? "" }),
		enabled: planRunId !== null,
		refetchInterval: (query) =>
			["QUEUED", "RUNNING", "WAITING_FOR_APPROVAL"].includes(
				query.state.data?.status ?? "",
			)
				? GTM_VIEW.poll.activeMs
				: false,
	});
	const create = useMutation(
		trpc.gtm.createCampaign.mutationOptions({
			onSuccess: async (campaign) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.gtm.campaigns.pathKey(),
				});
				toast.success(
					"Draft campaign created. Review its sequence before activation.",
				);
				router.push(workspaceUrl(`/outreach/campaigns/${campaign.id}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const source = material.trim();
	const readMaterial = async (file: File) => {
		setReadingFile(true);
		try {
			const extracted = await readSalesMaterial(file);
			setMaterial(extracted);
			setPlanRunId(null);
			setSourceFileName(file.name);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "The file could not be read.",
			);
		} finally {
			setReadingFile(false);
		}
	};

	return (
		<div className="space-y-6">
			<form
				className="space-y-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault();
					create.mutate({
						name: name.trim(),
						serviceLine,
						description:
							(planStatus.data?.plan
								? (planBriefOverride ?? planStatus.data.plan.brief).trim()
								: description.trim()) || null,
						sourceFileName,
						sourceMaterial: source || null,
						steps:
							planStatus.data?.plan?.steps ?? (source ? [...DRIP_STEPS] : []),
					});
				}}
			>
				<h2 className="font-medium">Create another India campaign</h2>
				<p className="text-sm text-muted-foreground">
					Upload sales material, generate a plan, and review every step before
					activation.
				</p>
				<div className="space-y-2">
					<Label htmlFor="campaign-service">Service</Label>
					<Select
						value={serviceLine}
						onValueChange={(value: typeof serviceLine) => {
							setServiceLine(value);
							setPlanRunId(null);
						}}
					>
						<SelectTrigger id="campaign-service">
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
					<Label htmlFor="campaign-name">Campaign name</Label>
					<Input
						id="campaign-name"
						value={name}
						onChange={(event) => {
							setName(event.target.value);
							setPlanRunId(null);
						}}
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
						onChange={(event) => {
							setDescription(event.target.value);
							setPlanRunId(null);
						}}
						placeholder="Who this campaign serves and what evidence it needs."
						maxLength={3000}
						rows={3}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="campaign-material-file">
						Sales playbook or material
					</Label>
					<Input
						id="campaign-material-file"
						type="file"
						accept=".docx,.txt,.md"
						disabled={readingFile}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) void readMaterial(file);
						}}
					/>
					<p className="text-xs text-muted-foreground">
						DOCX, TXT, or Markdown. Maximum 2 MB and 100,000 characters.
					</p>
					{sourceFileName ? (
						<p className="text-sm">
							Loaded: {sourceFileName} · {source.length} characters
						</p>
					) : null}
				</div>
				<div className="space-y-2">
					<Label htmlFor="campaign-material-text">Material text</Label>
					<Textarea
						id="campaign-material-text"
						value={material}
						onChange={(event) => {
							setMaterial(event.target.value);
							setPlanRunId(null);
							setSourceFileName(null);
						}}
						rows={5}
						maxLength={GTM_VIEW.material.maxCharacters}
						placeholder="Or paste product notes here."
					/>
				</div>
				{source ? (
					<div className="rounded-md border p-4 text-sm">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<p className="font-medium">Campaign sequence</p>
							<Button
								type="button"
								variant="outline"
								disabled={
									requestPlan.isPending ||
									name.trim().length < 3 ||
									source.length < 100
								}
								onClick={() =>
									requestPlan.mutate({
										serviceLine,
										campaignName: name.trim(),
										campaignBrief: description.trim() || null,
										campaignMaterial: source,
										clientRequestId: crypto.randomUUID(),
									})
								}
							>
								{requestPlan.isPending ? "Starting…" : "Generate from material"}
							</Button>
						</div>
						{planStatus.data?.status ? (
							<p className="mt-2">
								Planner:{" "}
								{planStatus.data.status.toLowerCase().replaceAll("_", " ")}
							</p>
						) : null}
						{planStatus.data?.errorMessage ? (
							<p className="mt-2 text-destructive">
								{planStatus.data.errorMessage}
							</p>
						) : null}
						{planRunId && !planStatus.data?.plan ? (
							<Button
								type="button"
								variant="ghost"
								onClick={() => setPlanRunId(null)}
							>
								Use starter steps
							</Button>
						) : null}
						{planStatus.data?.plan ? (
							<div className="mt-3 space-y-2">
								<Label htmlFor="campaign-generated-brief">
									Review generated brief
								</Label>
								<Textarea
									id="campaign-generated-brief"
									value={planBriefOverride ?? planStatus.data.plan.brief}
									onChange={(event) => setPlanBriefOverride(event.target.value)}
									maxLength={3000}
									rows={5}
								/>
							</div>
						) : null}
						<ol className="mt-2 list-inside list-decimal space-y-2">
							{(planStatus.data?.plan?.steps ?? DRIP_STEPS).map((step) => (
								<li key={`${step.delayDays}-${step.subjectPrompt}`}>
									Day {step.delayDays} after prior email · {step.subjectPrompt}
									<p className="ml-5 text-muted-foreground">
										{step.bodyPrompt}
									</p>
								</li>
							))}
						</ol>
						<p className="mt-2 text-muted-foreground">
							Review and edit all instructions on the next screen. This campaign
							stays in Draft.
						</p>
					</div>
				) : null}
				<Button
					type="submit"
					disabled={
						create.isPending ||
						readingFile ||
						(planRunId !== null && !planStatus.data?.plan)
					}
				>
					{create.isPending ? "Creating…" : "Create draft campaign"}
				</Button>
			</form>
			<div className="space-y-3">
				<h2 className="font-medium">
					Campaign plans · {campaigns.data?.length ?? 0}
				</h2>
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
							{campaign.sourceFileName ? (
								<p className="mt-2 text-muted-foreground text-xs">
									Source: {campaign.sourceFileName}
								</p>
							) : null}
							<p className="mt-3 text-muted-foreground text-sm">
								{campaign.targetCount}{" "}
								{campaign.targetCount === 1 ? "target" : "targets"} ·{" "}
								{campaign.serviceLine === "FILO_STORAGE"
									? `${campaign.qualifiedCount} meet Filo gate · `
									: ""}
								{campaign.stepCount} email steps · India
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
