import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellFallback,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";
import { FollowUpQueue } from "./follow-up-queue";
import { ThreadFeedback } from "./thread-feedback";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{
		thread?: string;
		page?: string;
		view?: string;
		mailbox?: string;
	}>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<InboxContent params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function InboxContent({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{
		thread?: string;
		page?: string;
		view?: string;
		mailbox?: string;
	}>;
}) {
	await connection();
	const [
		{ slug },
		{
			thread: requested,
			page: pageParam,
			view: viewParam,
			mailbox: mailboxParam,
		},
	] = await Promise.all([params, searchParams]);
	const requestedMailbox = mailboxParam?.trim().toLowerCase();
	const mailbox = z.email().safeParse(requestedMailbox).success
		? requestedMailbox
		: undefined;
	const client = getServerTrpcClient();
	const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
	const view =
		viewParam === "HIDDEN" ? ("HIDDEN" as const) : ("ACTIVE" as const);
	const [threads, drafts, followUps] = await Promise.all([
		client.inbox.list.query({ page, view, mailbox: mailbox || undefined }),
		client.outreachDrafts.list.query(),
		client.inbox.followUps.query(),
	]);
	const selectedId = threads.items.some((item) => item.id === requested)
		? requested
		: threads.items[0]?.id;
	const selected = selectedId
		? await client.inbox.thread
				.query({ id: selectedId })
				.catch(() => notFound())
		: null;
	const selectedFollowUp = followUps.find((row) => row.threadId === selectedId);

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Inbox</PageShellTitle>
					<PageShellDescription>
						Conversations synced from your connected mailboxes. This inbox is
						read only.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<FollowUpQueue initialRows={followUps} />
				<section className="mb-6">
					<h2 className="font-medium text-base">Drafts ({drafts.length})</h2>
					{drafts.length === 0 ? (
						<p className="mt-2 text-muted-foreground text-sm">
							No outreach drafts exist yet.
						</p>
					) : (
						<div className="mt-3 grid gap-3 md:grid-cols-2">
							{drafts.map((draft) => (
								<Link
									key={draft.runId}
									href={`/${slug}/outreach?draft=${encodeURIComponent(draft.runId)}`}
									className="rounded-lg border bg-card p-4 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
								>
									<span className="block truncate font-medium text-sm">
										{draft.subject}
									</span>
									<span className="mt-1 block text-muted-foreground text-xs">
										{draft.recipientEmail || "Recipient needed"} ·{" "}
										{draft.status === "APPROVED"
											? "Approved"
											: "Needs approval"}
									</span>
								</Link>
							))}
						</div>
					)}
				</section>
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-medium text-base">
						Mailbox conversations ({threads.total})
					</h2>
					<div className="flex gap-3 text-sm">
						<Link
							href={`/${slug}/inbox?view=ACTIVE&mailbox=${encodeURIComponent(mailbox ?? "")}`}
							className={
								view === "ACTIVE" ? "text-primary" : "text-muted-foreground"
							}
						>
							Active
						</Link>
						<Link
							href={`/${slug}/inbox?view=HIDDEN&mailbox=${encodeURIComponent(mailbox ?? "")}`}
							className={
								view === "HIDDEN" ? "text-primary" : "text-muted-foreground"
							}
						>
							Hidden
						</Link>
					</div>
				</div>
				<nav
					aria-label="Receiving mailbox"
					className="mb-4 flex flex-wrap gap-3 text-sm"
				>
					<Link
						href={`/${slug}/inbox?view=${view}`}
						className={!mailbox ? "text-primary" : "text-muted-foreground"}
					>
						All mailboxes
					</Link>
					{threads.mailboxes.map((address) => (
						<Link
							key={address}
							href={`/${slug}/inbox?view=${view}&mailbox=${encodeURIComponent(address)}`}
							className={
								mailbox === address ? "text-primary" : "text-muted-foreground"
							}
						>
							{address}
						</Link>
					))}
				</nav>
				{threads.items.length === 0 ? (
					<div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
						<h2 className="font-medium text-sm">
							{view === "HIDDEN"
								? "No hidden conversations"
								: "No CRM conversations yet"}
						</h2>
						<p className="mt-2 max-w-md text-muted-foreground text-sm">
							{view === "HIDDEN"
								? "Mark a conversation as not relevant or spam to remove it from the active inbox."
								: "Only mailbox conversations linked to CRM records appear here. Check your Microsoft connection and sync status."}
						</p>
						<Link
							href={`/${slug}/settings/connections/microsoft`}
							className="mt-4 text-primary text-sm hover:underline"
						>
							Open Microsoft connection
						</Link>
					</div>
				) : (
					<div className="grid min-h-96 overflow-hidden rounded-lg border md:h-[min(70vh,48rem)] md:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
						<nav
							aria-label="Conversations"
							className="max-h-80 overflow-y-auto border-b md:max-h-none md:border-r md:border-b-0"
						>
							{threads.items.map((thread) => (
								<Link
									key={thread.id}
									href={`/${slug}/inbox?view=${view}&page=${page}&mailbox=${encodeURIComponent(mailbox ?? "")}&thread=${encodeURIComponent(thread.id)}`}
									aria-current={thread.id === selectedId ? "page" : undefined}
									className={`block border-b px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50 ${thread.id === selectedId ? "bg-muted" : ""}`}
								>
									<span className="block truncate font-medium text-sm">
										{thread.subject || "No subject"}
									</span>
									<span className="mt-1 block truncate text-muted-foreground text-xs">
										{thread.lastMessage?.fromName ||
											thread.lastMessage?.fromEmail ||
											"Unknown sender"}
									</span>
									<span className="mt-1 block truncate text-muted-foreground text-xs">
										{thread.lastMessage?.snippet || "No preview"}
									</span>
									<span className="mt-1 block text-muted-foreground text-xs">
										{thread.messageCount} message
										{thread.messageCount === 1 ? "" : "s"}
									</span>
									<span className="mt-1 block truncate text-primary text-xs">
										{thread.mailboxAddresses.join(", ") || "Mailbox unknown"}
									</span>
								</Link>
							))}
						</nav>
						<section
							aria-label="Selected conversation"
							className="min-h-0 overflow-y-auto p-5"
						>
							<h2 className="text-lg font-medium">
								{selected?.subject || "No subject"}
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								Received by{" "}
								{selected?.mailboxAddresses.join(", ") || "unknown mailbox"}
							</p>
							{selectedFollowUp ? (
								<p className="mt-2 text-sm">
									Follow-up:{" "}
									{selectedFollowUp.owner === "ME"
										? "Your response is pending"
										: selectedFollowUp.owner === "CUSTOMER"
											? "Customer response is pending"
											: selectedFollowUp.owner === "NONE"
												? "No follow-up needed"
												: "Review needed"}
									{selectedFollowUp.dueAt
										? ` · Due ${new Date(selectedFollowUp.dueAt).toLocaleString("en-IN")}`
										: ""}
								</p>
							) : null}
							{selected ? (
								<ThreadFeedback
									threadId={selected.id}
									hidden={view === "HIDDEN"}
								/>
							) : null}
							{selected?.company ? (
								<Link
									href={`/${slug}/companies?record=company:${selected.company.id}`}
									className="mt-1 inline-block text-primary text-sm hover:underline"
								>
									{selected.company.name}
								</Link>
							) : null}
							<div className="mt-6 flex flex-col gap-5">
								{selected?.messages.map((message) => (
									<article key={message.id} className="rounded-lg border p-4">
										<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
											<strong>{message.fromName || message.fromEmail}</strong>
											<time className="text-muted-foreground text-xs">
												{new Date(message.sentAt).toLocaleString("en-IN")}
											</time>
										</div>
										<p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm">
											{message.body || message.snippet || "No message text"}
										</p>
										{message.mailboxUrl ? (
											<a
												href={message.mailboxUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="mt-3 inline-block text-primary text-xs hover:underline"
											>
												Open in mailbox
											</a>
										) : null}
									</article>
								))}
							</div>
						</section>
					</div>
				)}
				{threads.totalPages > 1 ? (
					<nav
						aria-label="Inbox pages"
						className="mt-4 flex items-center justify-end gap-4 text-sm"
					>
						{page > 1 ? (
							<Link
								href={`/${slug}/inbox?view=${view}&mailbox=${encodeURIComponent(mailbox ?? "")}&page=${page - 1}`}
								className="text-primary hover:underline"
							>
								Previous
							</Link>
						) : null}
						<span>
							Page {page} of {threads.totalPages}
						</span>
						{page < threads.totalPages ? (
							<Link
								href={`/${slug}/inbox?view=${view}&mailbox=${encodeURIComponent(mailbox ?? "")}&page=${page + 1}`}
								className="text-primary hover:underline"
							>
								Next
							</Link>
						) : null}
					</nav>
				) : null}
			</PageShellContent>
		</PageShell>
	);
}
