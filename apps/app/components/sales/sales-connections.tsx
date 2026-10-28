"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Status = RouterOutputs["salesIntegrations"]["status"];
type Events = RouterOutputs["salesIntegrations"]["closelyEvents"];
type Verifications = RouterOutputs["salesIntegrations"]["emailVerifications"];

export function SalesConnections({
	initialStatus,
	initialEvents,
	initialVerifications,
}: {
	initialStatus: Status;
	initialEvents: Events;
	initialVerifications: Verifications;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [activitySearch, setActivitySearch] = useState("");
	const [linkedInName, setLinkedInName] = useState(
		initialStatus.linkedInName ?? "",
	);
	const [linkedInUrl, setLinkedInUrl] = useState(
		initialStatus.linkedInUrl ?? "",
	);
	const [accountEmail, setAccountEmail] = useState(
		initialStatus.accountEmail ?? "",
	);
	const status = useQuery({
		...trpc.salesIntegrations.status.queryOptions(),
		initialData: initialStatus,
	});
	const events = useQuery({
		...trpc.salesIntegrations.closelyEvents.queryOptions(),
		initialData: initialEvents,
		refetchInterval: 15_000,
	});
	const verifications = useQuery({
		...trpc.salesIntegrations.emailVerifications.queryOptions(),
		initialData: initialVerifications,
		refetchInterval: 15_000,
	});
	const toggle = useMutation(
		trpc.salesIntegrations.setEmailHandoff.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.salesIntegrations.status.queryKey(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const recordAccount = useMutation(
		trpc.salesIntegrations.recordCloselyAccount.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.salesIntegrations.status.queryKey(),
				});
				toast.success("Closely account record saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const accounts = Array.from(
		new Map(
			events.data
				.filter((event) => event.accountEmail)
				.map((event) => [event.accountEmail, event]),
		).values(),
	);
	const matchingEvents = events.data.filter((event) =>
		[
			event.firstName,
			event.lastName,
			event.email,
			event.companyName,
			event.trigger,
			...event.campaignNames,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase()
			.includes(activitySearch.trim().toLowerCase()),
	);
	return (
		<div className="flex flex-col gap-6">
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Closely connection</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Contact events flow from Closely to CRM. Closely does not include the
					connected LinkedIn account or message delivery in this webhook.
				</p>
				{status.data.linkedInUrl ? (
					<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
						<a
							href={status.data.linkedInUrl}
							target="_blank"
							rel="noreferrer"
							className="text-primary hover:underline"
						>
							{status.data.linkedInName || "LinkedIn account"}
						</a>
						<span>{status.data.accountEmail}</span>
						<span className="text-muted-foreground">
							Recorded from Closely{" "}
							{status.data.accountCheckedAt
								? new Date(status.data.accountCheckedAt).toLocaleString("en-IN")
								: ""}
							. Live status stays in Closely.
						</span>
					</div>
				) : null}
				<form
					className="mt-4 flex flex-wrap items-end gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						recordAccount.mutate({ linkedInName, linkedInUrl, accountEmail });
					}}
				>
					<div className="flex min-w-40 flex-1 flex-col gap-2">
						<Label htmlFor="closely-linkedin-name">LinkedIn account name</Label>
						<Input
							id="closely-linkedin-name"
							value={linkedInName}
							onChange={(event) => setLinkedInName(event.target.value)}
							disabled={!status.data.canManage}
							required
						/>
					</div>
					<div className="flex min-w-48 flex-1 flex-col gap-2">
						<Label htmlFor="closely-linkedin-url">LinkedIn profile URL</Label>
						<Input
							id="closely-linkedin-url"
							type="url"
							value={linkedInUrl}
							onChange={(event) => setLinkedInUrl(event.target.value)}
							disabled={!status.data.canManage}
							required
						/>
					</div>
					<div className="flex min-w-48 flex-1 flex-col gap-2">
						<Label htmlFor="closely-account-email">Closely email account</Label>
						<Input
							id="closely-account-email"
							type="email"
							value={accountEmail}
							onChange={(event) => setAccountEmail(event.target.value)}
							disabled={!status.data.canManage}
							required
						/>
					</div>
					<Button
						type="submit"
						variant="outline"
						disabled={!status.data.canManage || recordAccount.isPending}
					>
						Record account
					</Button>
				</form>
				<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
					<Badge variant={status.data.receiving ? "default" : "outline"}>
						{status.data.receiving
							? "Contact events received"
							: "No contact events received"}
					</Badge>
					<span>Closely → CRM contact activity</span>
					<span className="text-muted-foreground">
						→ LinkedIn inbox stays in Closely
					</span>
				</div>
				{accounts.length ? (
					<div className="mt-4 flex flex-col divide-y">
						{accounts.map((account) => (
							<div
								key={account.accountEmail}
								className="flex flex-wrap justify-between gap-2 py-3 text-sm"
							>
								<span>{account.accountName || account.accountEmail}</span>
								<span className="text-muted-foreground">
									{account.accountEmail} · Seen in a contact event
								</span>
							</div>
						))}
					</div>
				) : (
					<p className="mt-4 text-muted-foreground text-sm">
						No sending account appears in received contact events.
					</p>
				)}
			</section>
			<section className="rounded-lg border bg-card p-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-col gap-2">
						<h2 className="font-medium">Closely LinkedIn activity</h2>
						<p className="text-muted-foreground text-sm">
							{status.data.configured
								? status.data.receiving
									? "Receiving contact events"
									: "Waiting for the first contact event"
								: "Webhook setup needed"}
						</p>
					</div>
					<Button asChild variant="outline" size="sm">
						<a
							href="https://app.closelyhq.com/0/linkedin-campaigns"
							target="_blank"
							rel="noreferrer"
						>
							Open Closely campaigns
						</a>
					</Button>
				</div>
				<p className="mt-3 text-muted-foreground text-sm">
					Closely sends contact sync events here. LinkedIn messages remain in
					the Closely inbox.
				</p>
				<Input
					className="mt-4"
					aria-label="Search Closely activity"
					placeholder="Search contacts, companies, campaigns, or events"
					value={activitySearch}
					onChange={(event) => setActivitySearch(event.target.value)}
				/>
				<div className="mt-5 flex flex-col divide-y">
					{matchingEvents.length === 0 ? (
						<p className="py-4 text-muted-foreground text-sm">
							{events.data.length
								? "No matching Closely activity."
								: "No Closely activity has reached the CRM yet."}
						</p>
					) : (
						matchingEvents.map((event) => (
							<div
								key={event.id}
								className="flex flex-wrap items-start justify-between gap-3 py-4"
							>
								<div className="flex flex-col gap-1">
									<p className="font-medium text-sm">{event.trigger}</p>
									<p className="text-muted-foreground text-sm">
										{[event.firstName, event.lastName]
											.filter(Boolean)
											.join(" ") ||
											event.email ||
											event.linkedinUrl ||
											"Unknown contact"}
										{event.companyName ? ` · ${event.companyName}` : ""}
									</p>
									{event.campaignNames.length ? (
										<p className="text-muted-foreground text-xs">
											{event.campaignNames.join(", ")}
										</p>
									) : null}
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="outline">
										{event.contactId ? "CRM contact linked" : "Needs match"}
									</Badge>
									{event.contactId ? (
										<Link
											className="text-primary text-sm hover:underline"
											href={workspaceUrl(
												`/contacts?record=contact:${event.contactId}`,
											)}
										>
											Open contact
										</Link>
									) : null}
									{event.linkedinUrl ? (
										<a
											className="text-primary text-sm hover:underline"
											href={event.linkedinUrl}
											target="_blank"
											rel="noreferrer"
										>
											LinkedIn profile
										</a>
									) : null}
									<time className="text-muted-foreground text-xs">
										{new Date(event.receivedAt).toLocaleString("en-IN")}
									</time>
								</div>
							</div>
						))
					)}
				</div>
			</section>
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Reoon email verification</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					The CRM checks contact emails automatically. Each contact and outreach
					draft shows its current result. Only safe addresses can be sent.
				</p>
				<div className="mt-5 flex flex-col divide-y">
					{verifications.data.length === 0 ? (
						<p className="py-4 text-muted-foreground text-sm">
							No CRM email checks yet.
						</p>
					) : (
						verifications.data.map((row) => (
							<div
								key={row.contactId}
								className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
							>
								<div>
									<p className="font-medium">{row.email}</p>
									<p className="text-muted-foreground text-xs">
										{row.status} · Checked{" "}
										{new Date(row.checkedAt).toLocaleString("en-IN")}
									</p>
								</div>
								<Badge variant={row.safe ? "default" : "destructive"}>
									{row.safe ? "Safe" : "Do not send"}
								</Badge>
							</div>
						))
					)}
				</div>
			</section>
			<section className="rounded-lg border bg-card p-5">
				<h2 className="font-medium">Closely email handoff</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					This opens Closely's own email campaigns using its connected
					terraeagle.com account. Closely controls its sends.
				</p>
				<p className="mt-2 text-muted-foreground text-sm">
					The CRM's DKIM pause still blocks CRM mailbox sending. Check recipient
					verification and campaign settings in Closely before launch.
				</p>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<Button
						type="button"
						variant="outline"
						disabled={!status.data.canManage || toggle.isPending}
						onClick={() =>
							toggle.mutate({ enabled: !status.data.emailHandoffEnabled })
						}
					>
						{status.data.emailHandoffEnabled
							? "Disable email handoff"
							: "Enable email handoff"}
					</Button>
					{status.data.emailHandoffEnabled ? (
						<Button asChild>
							<a
								href="https://app.closelyhq.com/0/email-campaigns"
								target="_blank"
								rel="noreferrer"
							>
								Open Closely email campaigns
							</a>
						</Button>
					) : null}
				</div>
			</section>
		</div>
	);
}
