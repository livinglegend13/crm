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
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { GTM_VIEW } from "./gtm-config";
import { readSalesMaterial } from "./read-sales-material";

type Knowledge = RouterOutputs["gtm"]["proposalKnowledge"];
type Services = RouterOutputs["gtm"]["services"];

export function ProposalKnowledge({
	initialKnowledge,
	services,
}: {
	initialKnowledge: Knowledge;
	services: Services;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const knowledge = useQuery({
		...trpc.gtm.proposalKnowledge.queryOptions(),
		initialData: initialKnowledge,
	});
	const [title, setTitle] = useState("");
	const [serviceId, setServiceId] = useState(
		services.find((service) => service.active)?.id ?? "",
	);
	const [sourceFileName, setSourceFileName] = useState<string | null>(null);
	const [content, setContent] = useState("");
	const [readingFile, setReadingFile] = useState(false);
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.gtm.proposalKnowledge.pathKey(),
		});
	const add = useMutation(
		trpc.gtm.addProposalKnowledge.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				setTitle("");
				setContent("");
				setSourceFileName(null);
				toast.success("Proposal saved for review.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const update = useMutation(
		trpc.gtm.updateProposalKnowledgeStatus.mutationOptions({
			onSuccess: async () => {
				await invalidate();
				toast.success("Proposal status updated.");
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
					add.mutate({
						title: title.trim(),
						serviceId,
						sourceFileName,
						content: content.trim(),
					});
				}}
			>
				<h2 className="font-medium">Add a sent proposal</h2>
				<p className="text-muted-foreground text-sm">
					Upload only material approved for internal reuse. Draft examples stay
					out of agent searches until an admin approves them.
				</p>
				<div className="space-y-2">
					<Label htmlFor="proposal-title">Title</Label>
					<Input
						id="proposal-title"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						minLength={3}
						maxLength={120}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="proposal-service">Service</Label>
					<Select value={serviceId} onValueChange={setServiceId}>
						<SelectTrigger id="proposal-service">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{services
								.filter((service) => service.active)
								.map((service) => (
									<SelectItem key={service.id} value={service.id}>
										{service.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="proposal-file">Proposal file</Label>
					<Input
						id="proposal-file"
						type="file"
						accept=".docx,.txt,.md"
						disabled={readingFile}
						onChange={async (event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							setReadingFile(true);
							try {
								setContent(await readSalesMaterial(file));
								setSourceFileName(file.name);
							} catch (error) {
								toast.error(
									error instanceof Error
										? error.message
										: "The file could not be read.",
								);
							} finally {
								setReadingFile(false);
							}
						}}
					/>
					<p className="text-muted-foreground text-xs">
						DOCX, TXT, or Markdown. Maximum 2 MB and 100,000 characters.
					</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="proposal-content">Proposal text</Label>
					<Textarea
						id="proposal-content"
						value={content}
						onChange={(event) => {
							setContent(event.target.value);
							setSourceFileName(null);
						}}
						rows={8}
						maxLength={GTM_VIEW.material.maxCharacters}
					/>
				</div>
				<Button
					type="submit"
					disabled={
						add.isPending ||
						readingFile ||
						title.trim().length < 3 ||
						content.trim().length < 100 ||
						!serviceId
					}
				>
					{add.isPending ? "Saving…" : "Save draft example"}
				</Button>
			</form>
			<section className="space-y-3">
				<h2 className="font-medium">
					Proposal examples · {knowledge.data?.rows.length ?? 0}
				</h2>
				{knowledge.data?.rows.length ? (
					knowledge.data.rows.map((row) => (
						<div key={row.id} className="rounded-lg border bg-card p-5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h3 className="font-medium">{row.title}</h3>
								<Badge variant="outline">{row.status.toLowerCase()}</Badge>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">
								{row.serviceName} · {row.sourceFileName ?? "Pasted text"}
							</p>
							<details className="mt-3">
								<summary className="cursor-pointer text-sm">
									Review source text
								</summary>
								<pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm">
									{row.content}
								</pre>
							</details>
							{knowledge.data?.canApprove ? (
								<div className="mt-3 flex gap-2">
									{row.status === "DRAFT" ? (
										<Button
											size="sm"
											disabled={update.isPending}
											onClick={() =>
												update.mutate({ id: row.id, status: "APPROVED" })
											}
										>
											Approve for agent use
										</Button>
									) : null}
									<Button
										variant="outline"
										size="sm"
										disabled={update.isPending}
										onClick={() =>
											update.mutate({ id: row.id, status: "ARCHIVED" })
										}
									>
										Archive
									</Button>
								</div>
							) : null}
						</div>
					))
				) : (
					<p className="text-muted-foreground text-sm">
						No approved proposal examples have been added.
					</p>
				)}
			</section>
		</div>
	);
}
