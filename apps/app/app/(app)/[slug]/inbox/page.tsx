import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
	PageShellFallback,
} from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ thread?: string }>;
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
	searchParams: Promise<{ thread?: string }>;
}) {
	await connection();
	const [{ slug }, { thread: requested }] = await Promise.all([
		params,
		searchParams,
	]);
	const client = getServerTrpcClient();
	const threads = await client.inbox.list.query();
	const selectedId = requested ?? threads[0]?.id;
	if (requested && !threads.some((thread) => thread.id === requested))
		notFound();
	const selected = selectedId
		? await client.inbox.thread.query({ id: selectedId })
		: null;

	return (
		<PageShell className="min-h-0" contained>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Inbox</PageShellTitle>
					<PageShellDescription>
						Conversations synced from your connected mailbox. This inbox is read
						only.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent className="min-h-0">
				{threads.length === 0 ? (
					<div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
						<h2 className="font-medium text-sm">No synced conversations</h2>
						<p className="mt-2 max-w-md text-muted-foreground text-sm">
							Connect Microsoft 365 and run mailbox sync to see your CRM
							conversations here.
						</p>
						<Link
							href={`/${slug}/settings/connections/microsoft`}
							className="mt-4 text-primary text-sm hover:underline"
						>
							Open Microsoft connection
						</Link>
					</div>
				) : (
					<div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border md:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
						<nav
							aria-label="Conversations"
							className="min-h-0 overflow-y-auto border-b md:border-r md:border-b-0"
						>
							{threads.map((thread) => (
								<Link
									key={thread.id}
									href={`/${slug}/inbox?thread=${encodeURIComponent(thread.id)}`}
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
			</PageShellContent>
		</PageShell>
	);
}
