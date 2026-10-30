"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Snapshot = RouterOutputs["dashboard"]["summary"]["gtm"];

const steps = [
	{ label: "Find prospects", path: "/outreach", source: "Campaigns" },
	{
		label: "Detect signals",
		path: "/outreach/integrations",
		source: "Closely events",
	},
	{ label: "Research", path: "/research", source: "Research" },
	{ label: "Enrich contacts", path: "/contacts", source: "Contacts" },
	{ label: "Choose an angle", path: "/agents", source: "Agents" },
	{ label: "Draft outreach", path: "/outreach", source: "Approval queue" },
	{ label: "Manage replies", path: "/inbox", source: "Inbox" },
	{ label: "Qualify and meet", path: "/deals", source: "Deals" },
] as const;

export function GtmCommandCenter({ data }: { data: Snapshot }) {
	const workspaceUrl = useWorkspaceUrl();
	return (
		<Card className="overflow-hidden">
			<CardHeader>
				<CardTitle>GTM command center</CardTitle>
				<CardDescription>
					Live CRM records across the sales workflow
				</CardDescription>
			</CardHeader>
			<div className="grid gap-4 border-t p-4 lg:grid-cols-[1.15fr_0.85fr] lg:p-6">
				<div className="space-y-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<Connection
							label="Closely LinkedIn"
							value={data.linkedin.name}
							connected={data.linkedin.connected}
							detail={
								data.linkedin.lastEventAt
									? `Last contact event ${new Date(data.linkedin.lastEventAt).toLocaleString()}`
									: "No contact events received"
							}
							href={workspaceUrl("/outreach/integrations")}
						/>
						<Connection
							label="Closely email account"
							value={data.email.address}
							connected={data.email.connected}
							detail="CRM send access requires Closely API support"
							href={workspaceUrl("/outreach/integrations")}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<Metric
							value={data.bookedThisWeek}
							label="Calendar events this week"
						/>
						<Metric value={data.pendingDrafts} label="Open email drafts" />
						<Metric value={data.readyCampaigns} label="Ready campaigns" />
						<CommunicationMetric
							value={data.emailsSent}
							label="Your emails sent"
							channel="email"
						/>
						<CommunicationMetric
							value={data.whatsappInitiated}
							label="Your WhatsApp initiated"
							channel="whatsapp"
						/>
					</div>
					<section aria-labelledby="workflow-heading">
						<h3 id="workflow-heading" className="mb-2 text-sm font-semibold">
							Sales workflow
						</h3>
						<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
							{steps.map((step, index) => (
								<Link
									key={step.label}
									href={workspaceUrl(step.path)}
									className="group border bg-background p-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									<span className="text-xs text-muted-foreground">
										{String(index + 1).padStart(2, "0")} · {step.source}
									</span>
									<span className="mt-1 block text-sm font-medium group-hover:underline">
										{step.label} →
									</span>
								</Link>
							))}
						</div>
					</section>
				</div>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
					<section
						aria-labelledby="live-heading"
						className="border bg-background"
					>
						<h3
							id="live-heading"
							className="border-b px-4 py-3 text-sm font-semibold"
						>
							Recent activity
						</h3>
						{data.activity.length ? (
							<ul className="max-h-72 divide-y overflow-y-auto">
								{data.activity.map((item) => (
									<li key={`${item.source}:${item.id}`}>
										<Link
											href={workspaceUrl(item.href)}
											className="block px-4 py-3 hover:bg-muted"
										>
											<span className="flex items-center justify-between gap-2">
												<span className="truncate text-sm font-medium">
													{item.title}
												</span>
												<span className="shrink-0 text-xs text-muted-foreground">
													{new Date(item.at).toLocaleDateString()}
												</span>
											</span>
											<span className="block truncate text-xs text-muted-foreground">
												{item.source} · {item.detail}
												{item.context ? ` · ${item.context}` : ""}
											</span>
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p className="px-4 py-5 text-sm text-muted-foreground">
								No Closely events, drafts, or agent runs are recorded.
							</p>
						)}
					</section>
					<section
						aria-labelledby="meetings-heading"
						className="border bg-background"
					>
						<h3
							id="meetings-heading"
							className="border-b px-4 py-3 text-sm font-semibold"
						>
							Upcoming meetings
						</h3>
						{data.meetings.length ? (
							<ul className="divide-y">
								{data.meetings.map((meeting) => (
									<li key={meeting.id} className="px-4 py-3">
										<span className="block text-sm font-medium">
											{meeting.title}
										</span>
										<span className="block text-xs text-muted-foreground">
											{new Date(meeting.startsAt).toLocaleString()}
											{meeting.contact ? ` · ${meeting.contact}` : ""}
											{meeting.company ? ` · ${meeting.company}` : ""}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p className="px-4 py-5 text-sm text-muted-foreground">
								No synced calendar events in the next seven days.
							</p>
						)}
					</section>
				</div>
			</div>
		</Card>
	);
}

function Connection({
	label,
	value,
	connected,
	detail,
	href,
}: {
	label: string;
	value: string | null;
	connected: boolean;
	detail: string;
	href: string;
}) {
	return (
		<Link
			href={href}
			className="border bg-background p-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			<span className="flex items-center justify-between gap-2 text-sm font-medium">
				<span>{label}</span>
				<span
					className={
						connected
							? "text-emerald-600 dark:text-emerald-400"
							: "text-muted-foreground"
					}
				>
					{connected ? "Linked" : "Not linked"}
				</span>
			</span>
			<span className="mt-1 block truncate text-xs text-muted-foreground">
				{value ?? detail}
			</span>
			{value ? (
				<span className="mt-1 block text-xs text-muted-foreground">
					{detail}
				</span>
			) : null}
		</Link>
	);
}

function Metric({ value, label }: { value: number; label: string }) {
	return (
		<div className="border bg-background p-3">
			<span className="block text-2xl font-semibold tabular-nums">{value}</span>
			<span className="block text-xs text-muted-foreground">{label}</span>
		</div>
	);
}

function CommunicationMetric({
	value,
	label,
	channel,
}: {
	value: number;
	label: string;
	channel: "email" | "whatsapp";
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const [open, setOpen] = useState(false);
	const [page, setPage] = useState(0);
	const history = useQuery({
		...trpc.dashboard.communications.queryOptions({ channel, page }),
		enabled: open,
	});
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="border bg-background p-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				<span className="block text-2xl font-semibold tabular-nums">
					{value}
				</span>
				<span className="block text-xs text-muted-foreground">
					{label} · View details
				</span>
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>{label}</DialogTitle>
						<DialogDescription>
							{channel === "whatsapp"
								? "A click opens WhatsApp. The CRM cannot confirm delivery."
								: "Synced personal Outlook messages and CRM sends. Confirmed delivery failures are excluded."}
						</DialogDescription>
					</DialogHeader>
					<div className="divide-y px-4">
						{history.isPending ? <p>Loading activity…</p> : null}
						{history.data?.rows.map((row) => (
							<details key={`${row.source}:${row.id}`} className="py-3">
								<summary className="cursor-pointer font-medium">
									{row.title} · {row.recipient}
								</summary>
								<p className="text-muted-foreground text-sm">
									{row.source} · {new Date(row.at).toLocaleString()}
								</p>
								{row.body ? (
									<p className="mt-2 whitespace-pre-wrap text-sm">{row.body}</p>
								) : null}
								{row.contactId ? (
									<Link
										href={workspaceUrl(
											`/contacts?record=contact:${row.contactId}`,
										)}
										className="text-primary underline"
									>
										Open contact
									</Link>
								) : null}
							</details>
						))}
						{history.data?.total === 0 ? (
							<p className="py-4">No activity yet.</p>
						) : null}
					</div>
					<div className="flex items-center justify-between px-4 pb-4">
						<Button
							variant="outline"
							disabled={page === 0}
							onClick={() => setPage(page - 1)}
						>
							Previous
						</Button>
						<span className="text-sm text-muted-foreground">
							Page {page + 1}
						</span>
						<Button
							variant="outline"
							disabled={!history.data || (page + 1) * 20 >= history.data.total}
							onClick={() => setPage(page + 1)}
						>
							Next
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
