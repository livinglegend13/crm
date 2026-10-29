"use client";

import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function ScanCardLink() {
	const workspaceUrl = useWorkspaceUrl();
	return (
		<Button asChild variant="outline">
			<Link href={workspaceUrl("/contacts/cards")}>Scan business card</Link>
		</Button>
	);
}
