"use client";

import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Markdown } from "@crm/ui/components/markdown";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Feed = RouterOutputs["activities"]["researchFeed"];

export function ResearchBrowser({ initialFeed }: { initialFeed: Feed }) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const [draft, setDraft] = useState("");
	const [query, setQuery] = useState("");
	const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
	const cursor = cursors.at(-1);
	const feed = useQuery({
		...trpc.activities.researchFeed.queryOptions({ limit: 20, query, cursor }),
		initialData: query || cursor ? undefined : initialFeed,
	});
	const entries = feed.data?.entries ?? [];

	return (
		<section className="mb-5 rounded-lg border bg-card p-5">
			<h2 className="font-medium">Research library</h2>
			<p className="mt-1 text-muted-foreground text-sm">
				Search saved research by company, contact, deal, or note text.
			</p>
			<form
				className="mt-4 flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					setQuery(draft.trim());
					setCursors([undefined]);
				}}
			>
				<Input
					aria-label="Search research"
					placeholder="Company name or research term"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
				/>
				<Button type="submit">Search</Button>
			</form>
			{query ? (
				<p className="mt-3 text-muted-foreground text-xs">
					Results for “{query}”
				</p>
			) : null}
			{feed.isPending ? (
				<p className="mt-4 text-muted-foreground text-sm">Loading research…</p>
			) : null}
			{feed.isError ? (
				<p className="mt-4 text-destructive text-sm">
					Research could not load. Retry the search.
				</p>
			) : null}
			<div className="mt-4 divide-y">
				{entries.map((entry) => {
					const record = entry.deal
						? {
								label: entry.deal.name,
								path: `/deals?record=deal:${entry.deal.id}`,
							}
						: entry.contact
							? {
									label: [entry.contact.firstName, entry.contact.lastName]
										.filter(Boolean)
										.join(" "),
									path: `/contacts?record=contact:${entry.contact.id}`,
								}
							: entry.company
								? {
										label: entry.company.name,
										path: `/companies?record=company:${entry.company.id}`,
									}
								: null;
					return (
						<article key={entry.id} className="py-3 first:pt-0 last:pb-0">
							<details className="group">
								<summary className="cursor-pointer list-none rounded-md px-2 py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
									<span className="block font-medium text-sm">
										{entry.subject ?? "Research note"}
									</span>
									<span className="mt-1 block text-muted-foreground text-xs">
										{record?.label ?? "Unlinked record"} ·{" "}
										{entry.occurredAt
											? new Date(entry.occurredAt).toLocaleString("en-IN")
											: "Date unknown"}
									</span>
									<span className="mt-1 block text-primary text-xs group-open:hidden">
										Open research
									</span>
								</summary>
								<div className="px-2 pb-3 pt-2">
									{record ? (
										<Link
											href={workspaceUrl(record.path)}
											className="mb-3 inline-block text-primary text-xs hover:underline"
										>
											Open {record.label} in CRM
										</Link>
									) : null}
									{entry.body ? (
										<Markdown className="text-sm">{entry.body}</Markdown>
									) : (
										<p className="text-muted-foreground text-sm">
											No details were saved.
										</p>
									)}
								</div>
							</details>
						</article>
					);
				})}
			</div>
			{!feed.isPending && !feed.isError && entries.length === 0 ? (
				<p className="mt-4 text-muted-foreground text-sm">
					No research matches this search.
				</p>
			) : null}
			<div className="mt-4 flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={cursors.length === 1 || feed.isFetching}
					onClick={() => setCursors((current) => current.slice(0, -1))}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!feed.data?.nextCursor || feed.isFetching}
					onClick={() =>
						setCursors((current) => [
							...current,
							feed.data?.nextCursor ?? undefined,
						])
					}
				>
					Next
				</Button>
			</div>
		</section>
	);
}
