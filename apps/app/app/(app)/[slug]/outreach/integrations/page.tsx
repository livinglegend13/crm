import type { Metadata } from "next";
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
import { GtmNav } from "@/components/sales/gtm-nav";
import { SalesConnections } from "@/components/sales/sales-connections";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Sales connections" };

export default function SalesConnectionsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<SalesConnectionsContent />
		</Suspense>
	);
}

async function SalesConnectionsContent() {
	await connection();
	const client = getServerTrpcClient();
	const [status, events, verifications] = await Promise.all([
		client.salesIntegrations.status.query(),
		client.salesIntegrations.closelyEvents.query(),
		client.salesIntegrations.emailVerifications.query(),
	]);
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Sales connections</PageShellTitle>
					<PageShellDescription>
						Review Closely activity and verify CRM contact email addresses with
						Reoon.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="integrations" />
				<SalesConnections
					initialStatus={status}
					initialEvents={events}
					initialVerifications={verifications}
				/>
			</PageShellContent>
		</PageShell>
	);
}
