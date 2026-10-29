import type { Metadata } from "next";
import { BusinessCardScanner } from "@/components/crm/business-card-scanner";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Scan business cards" };

export default async function BusinessCardsPage() {
	await requireSession();
	return <BusinessCardScanner />;
}
