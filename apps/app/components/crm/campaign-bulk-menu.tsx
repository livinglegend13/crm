"use client";

import {
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@crm/ui/components/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function CampaignBulkMenu({
	ids,
	kind,
	onDone,
}: {
	ids: string[];
	kind: "company" | "contact";
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const campaigns = useQuery(trpc.gtm.campaigns.queryOptions());
	const add = useMutation(
		trpc.gtm.addTargets.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.gtm.campaigns.queryKey(),
				});
				toast.success(
					`${result.added} added to campaign. ${result.skipped} skipped.`,
					{
						description: result.reasons.join(" "),
					},
				);
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger disabled={add.isPending}>
				Add to outreach campaign
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="max-h-72 min-w-64 overflow-y-auto">
				{campaigns.data?.map((campaign) => (
					<DropdownMenuItem
						key={campaign.id}
						onSelect={() => add.mutate({ id: campaign.id, kind, ids })}
					>
						{campaign.name} · {campaign.marketCountryCode} ·{" "}
						{campaign.status.toLowerCase()}
					</DropdownMenuItem>
				))}
				{campaigns.data?.length === 0 ? (
					<DropdownMenuItem disabled>
						Create a campaign in Outreach first.
					</DropdownMenuItem>
				) : null}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
