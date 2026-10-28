"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function FollowUpAlert() {
	const trpc = useTRPC();
	const url = useWorkspaceUrl();
	const { data: rows = [] } = useQuery({
		...trpc.inbox.followUps.queryOptions(),
		refetchInterval: 60_000,
	});
	const urgent = rows.filter(
		(row) =>
			row.owner === "ME" &&
			!row.dismissedAt &&
			(!row.snoozedUntil || new Date(row.snoozedUntil) <= new Date()),
	);
	if (urgent.length === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{urgent.length} customer conversations need your reply
				</CardTitle>
				<CardDescription>
					Your connected mailbox has the latest customer message in these
					conversations.
				</CardDescription>
				<Button asChild variant="outline" size="sm">
					<Link href={url("/inbox")}>Review follow-ups</Link>
				</Button>
			</CardHeader>
		</Card>
	);
}
