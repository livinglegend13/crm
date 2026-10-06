import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
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

export const metadata: Metadata = { title: "Research" };

export default function ResearchPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<ResearchContent params={params} />
		</Suspense>
	);
}

async function ResearchContent({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	await connection();
	const { slug } = await params;
	const client = getServerTrpcClient();
	const agents = (await client.agents.list.query()).filter((agent) =>
		/research|qualif/i.test(agent.name),
	);
	const rows = await Promise.all(
		agents.map(async (agent) => {
			const runs = await client.agents.history.query({
				id: agent.id,
				limit: 10,
			});
			return {
				agent,
				runs: await Promise.all(
					runs.map(async (run) => {
						const noteId = run.result?.noteActivityId;
						const companyId = run.actions.find(
							(action) => action.targetType === "company" && action.targetId,
						)?.targetId;
						const timeline =
							typeof noteId === "string" && companyId
								? await client.activities.timeline.query({
										companyId,
										filter: "notes",
										limit: 100,
									})
								: null;
						const note = timeline?.entries.find((entry) => entry.id === noteId);
						return { ...run, researchNote: note?.body ?? null };
					}),
				),
			};
		}),
	);

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Research</PageShellTitle>
					<PageShellDescription>
						Review saved evidence before changing a company’s Filo fit. The
						qualification gate uses 1 PB average stored capacity over 12 months.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Link
					href={`/${slug}/companies?contactCoverage=none`}
					className="mb-5 inline-block text-primary text-sm hover:underline"
				>
					Review companies with no contacts
				</Link>
				{rows.length === 0 ? (
					<div className="rounded-lg border border-dashed p-6 text-sm">
						No research agents are visible in this workspace.
					</div>
				) : (
					<div className="flex flex-col gap-5">
						{rows.map(({ agent, runs }) => (
							<section key={agent.id} className="rounded-lg border bg-card p-5">
								<h2 className="font-medium text-base">{agent.name}</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									{runs.length} recent runs
								</p>
								{runs.map((run) => {
									const sourceUrls = [
										...new Set(
											(run.researchNote?.match(/https:\/\/[^\s)]+/g) ?? []).map(
												(url) => url.replace(/[.,;]+$/, ""),
											),
										),
									];
									const entries = Object.entries(run.result ?? {}).filter(
										([key, value]) =>
											!/ActivityId/i.test(key) && typeof value === "string",
									);
									const usesOldMetric = /annual storage|PB\/year/i.test(
										run.researchNote ?? "",
									);
									const companyAction = run.actions.find(
										(action) =>
											action.targetType === "company" && action.targetId,
									);
									return (
										<div key={run.id} className="mt-4 border-t pt-4">
											<div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
												<span>{run.status.toLowerCase()}</span>
												<time>
													{new Date(run.createdAt).toLocaleString("en-IN")}
												</time>
												{companyAction?.targetId ? (
													<Link
														href={`/${slug}/companies?record=company:${companyAction.targetId}`}
														className="text-primary hover:underline"
													>
														{companyAction.targetLabel || "Open company"}
													</Link>
												) : null}
											</div>
											{usesOldMetric ? (
												<p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
													This historical note uses an older storage metric.
													Confirm 1 PB average stored capacity over 12 months
													before qualification.
												</p>
											) : null}
											{entries.length > 0 ? (
												<dl className="mt-4 grid gap-4">
													{entries.map(([key, value]) => (
														<div key={key}>
															<dt className="font-medium text-sm">{key}</dt>
															<dd className="mt-1 whitespace-pre-wrap wrap-break-word text-sm">
																{value as string}
															</dd>
														</div>
													))}
												</dl>
											) : (
												<p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm">
													{run.summary || "No research result saved."}
												</p>
											)}
											{sourceUrls.length > 0 ? (
												<div className="mt-5">
													<h3 className="font-medium text-sm">
														Sources in the research note
													</h3>
													<ul className="mt-2 flex flex-col gap-1 text-sm">
														{sourceUrls.map((url) => (
															<li key={url}>
																<a
																	href={url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="break-all text-primary hover:underline"
																>
																	{url}
																</a>
															</li>
														))}
													</ul>
												</div>
											) : (
												<p className="mt-4 text-muted-foreground text-sm">
													This run saved no source links. Storage capacity
													remains unverified.
												</p>
											)}
											{run.researchNote ? (
												<details className="mt-5 rounded-lg border p-4">
													<summary className="cursor-pointer font-medium text-sm">
														Full research note
													</summary>
													<p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm">
														{run.researchNote}
													</p>
												</details>
											) : null}
										</div>
									);
								})}
								<Link
									href={`/${slug}/agents/${agent.id}`}
									className="mt-4 inline-block text-primary text-xs hover:underline"
								>
									Open agent and full run history
								</Link>
							</section>
						))}
					</div>
				)}
			</PageShellContent>
		</PageShell>
	);
}
