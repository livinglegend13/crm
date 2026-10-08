"use client";

import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function GtmNav({
	current,
}: {
	current:
		| "drafts"
		| "prospects"
		| "campaigns"
		| "services"
		| "proposals"
		| "insights";
}) {
	const workspaceUrl = useWorkspaceUrl();
	const links = [
		{ id: "drafts", label: "Drafts", path: "/outreach" },
		{ id: "prospects", label: "Prospecting", path: "/outreach/prospects" },
		{ id: "campaigns", label: "Campaigns", path: "/outreach/campaigns" },
		{ id: "services", label: "Services", path: "/outreach/services" },
		{ id: "proposals", label: "Proposals", path: "/outreach/proposals" },
		{ id: "insights", label: "Insights", path: "/outreach/insights" },
	] as const;
	return (
		<nav aria-label="Outreach sections" className="mb-6 flex flex-wrap gap-2">
			{links.map((link) => (
				<Button
					key={link.id}
					asChild
					variant={current === link.id ? "default" : "outline"}
					size="sm"
				>
					<Link
						href={workspaceUrl(link.path)}
						aria-current={current === link.id ? "page" : undefined}
					>
						{link.label}
					</Link>
				</Button>
			))}
		</nav>
	);
}
