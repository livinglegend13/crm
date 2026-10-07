import type { Metadata } from "next";
import { connection } from "next/server";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { GtmNav } from "@/components/sales/gtm-nav";
import { ProspectBoard } from "@/components/sales/prospect-board";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Filo prospecting" };

export default async function ProspectsPage() {
	await connection();
	const client = getServerTrpcClient();
	const [prospects, campaigns] = await Promise.all([
		client.gtm.prospects.query({ q: "", decision: "ALL", offset: 0, limit: 25 }),
		client.gtm.campaigns.query(),
	]);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Filo prospecting</PageShellTitle>
					<PageShellDescription>
						Review India companies against Filo’s 1 PB average-capacity gate. Record evidence before qualification.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="prospects" />
				<ProspectBoard initialProspects={prospects} initialCampaigns={campaigns} />
			</PageShellContent>
		</PageShell>
	);
}
