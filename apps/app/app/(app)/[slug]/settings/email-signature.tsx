"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function EmailSignature() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const id = useId();
	const signature = useQuery(trpc.users.emailSignature.queryOptions());
	const [draft, setDraft] = useState<string | null>(null);
	const save = useMutation(
		trpc.users.setEmailSignature.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.users.emailSignature.queryKey(),
				});
				setDraft(null);
				toast.success("Email signature saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>My email signature</CardTitle>
				<CardDescription>
					New messages from your mailbox use this signature. Shared sender
					mailboxes keep their own names.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({ signature: draft ?? signature.data ?? "" });
					}}
				>
					<label className="block font-medium text-sm" htmlFor={id}>
						Signature
					</label>
					<Textarea
						id={id}
						rows={9}
						value={draft ?? signature.data ?? ""}
						onChange={(event) => setDraft(event.target.value)}
						maxLength={4000}
					/>
					<Button type="submit" disabled={save.isPending || draft === null}>
						Save signature
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
