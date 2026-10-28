"use client";

import { Button } from "@crm/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function ThreadFeedback({
	threadId,
	hidden,
}: {
	threadId: string;
	hidden: boolean;
}) {
	const router = useRouter();
	const trpc = useTRPC();
	const mutation = useMutation(
		trpc.inbox.feedback.mutationOptions({
			onSuccess: (_result, variables) => {
				toast.success("Inbox feedback saved.");
				router.replace(
					`${window.location.pathname}?view=${variables.label === "RESTORE" ? "ACTIVE" : "HIDDEN"}`,
				);
				router.refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<div className="mt-3 flex flex-wrap gap-2">
			{hidden ? (
				<Button
					variant="outline"
					size="sm"
					disabled={mutation.isPending}
					onClick={() => mutation.mutate({ threadId, label: "RESTORE" })}
				>
					Show in inbox
				</Button>
			) : (
				<>
					<Button
						variant="outline"
						size="sm"
						disabled={mutation.isPending}
						onClick={() => mutation.mutate({ threadId, label: "NOT_RELEVANT" })}
					>
						Not relevant
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={mutation.isPending}
						onClick={() => mutation.mutate({ threadId, label: "SPAM" })}
					>
						Spam
					</Button>
				</>
			)}
			<p className="w-full text-muted-foreground text-xs">
				Feedback updates this conversation and helps classify future mail.
				Hidden conversations leave the follow-up queue.
			</p>
		</div>
	);
}
