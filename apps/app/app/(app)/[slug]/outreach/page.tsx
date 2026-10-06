import type { Metadata } from "next";
import Link from "next/link";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Outreach drafts" };

export default async function OutreachPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const client = getServerTrpcClient();
	const agents = (await client.agents.list.query()).filter((agent) =>
		/outreach|email/i.test(agent.name),
	);
	const histories = await Promise.all(
		agents.map(async (agent) => ({
			agent,
			runs: await client.agents.history.query({ id: agent.id, limit: 20 }),
		})),
	);
	const drafts = histories.flatMap(({ agent, runs }) =>
		runs.flatMap((run) => {
			const entries = Object.entries(run.result ?? {});
			const subject = entries.find(
				([key, value]) =>
					/email.*subject|subject/i.test(key) && typeof value === "string",
			)?.[1];
			const body = entries.find(
				([key, value]) =>
					/email.*body|draft.*body/i.test(key) && typeof value === "string",
			)?.[1];
			return typeof body === "string"
				? [
						{
							agent,
							run,
							subject: typeof subject === "string" ? subject : "No subject",
							body,
						},
					]
				: [];
		}),
	);

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Outreach drafts</PageShellTitle>
					<PageShellDescription>
						Review agent drafts here. The CRM does not send these messages.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				{drafts.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-sm">
						No saved outreach drafts yet. Open an outreach agent and review its
						runs.
					</div>
				) : (
					<div className="flex flex-col gap-5">
						{drafts.map((draft) => (
							<article
								key={draft.run.id}
								className="rounded-lg border bg-card p-5"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h2 className="font-medium text-base">{draft.subject}</h2>
									<span className="text-muted-foreground text-xs">
										Draft only ·{" "}
										{new Date(draft.run.createdAt).toLocaleString("en-IN")}
									</span>
								</div>
								<p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm">
									{draft.body}
								</p>
								<Link
									href={`/${slug}/agents/${draft.agent.id}`}
									className="mt-4 inline-block text-primary text-xs hover:underline"
								>
									View {draft.agent.name} run
								</Link>
							</article>
						))}
					</div>
				)}
			</PageShellContent>
		</PageShell>
	);
}
