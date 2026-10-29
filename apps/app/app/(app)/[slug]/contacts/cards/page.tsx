import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BusinessCardScanner } from "@/components/crm/business-card-scanner";
import { PageShellFallback } from "@/components/page-shell";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Scan business cards" };

export default function BusinessCardsPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<BusinessCardsContent />
		</Suspense>
	);
}

async function BusinessCardsContent() {
	await connection();
	await requireSession();
	return <BusinessCardScanner />;
}
