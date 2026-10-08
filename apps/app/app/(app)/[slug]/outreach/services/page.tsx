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
import { ServiceCatalog } from "@/components/sales/service-catalog";
import { getServerTrpcClient } from "@/lib/trpc/server";

export const metadata: Metadata = { title: "Terraeagle services" };

export default function ServicesPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<ServicesContent />
		</Suspense>
	);
}

async function ServicesContent() {
	await connection();
	const client = getServerTrpcClient();
	const services = await client.gtm.services.query();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Services and countries</PageShellTitle>
					<PageShellDescription>
						Set the offerings and markets for Terraeagle campaigns.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<GtmNav current="services" />
				<ServiceCatalog initialServices={services} />
			</PageShellContent>
		</PageShell>
	);
}
