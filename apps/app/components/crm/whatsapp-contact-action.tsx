"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@crm/ui/components/dialog";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

function suggestedMessage(firstName: string, meetingContext: string) {
	const meeting = meetingContext.trim() ? ` at ${meetingContext.trim()}` : "";
	return `Hi ${firstName}, it was a pleasure meeting you${meeting}. I enjoyed our conversation and would like to explore potential collaboration between your team and Terraeagle. Would you be open to a short call next week? Regards, Terraeagle`;
}

export function WhatsAppContactAction({
	contactId,
	firstName,
	initialMessage,
}: {
	contactId: string;
	firstName: string;
	initialMessage?: string;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const contextId = useId();
	const messageId = useId();
	const [open, setOpen] = useState(false);
	const [meetingContext, setMeetingContext] = useState("");
	const [editedMessage, setEditedMessage] = useState<string | null>(
		initialMessage ?? null,
	);
	const message = editedMessage ?? suggestedMessage(firstName, meetingContext);
	const initiate = useMutation(
		trpc.contacts.initiateWhatsApp.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const launch = async () => {
		const tab = window.open("about:blank", "_blank");
		if (!tab) {
			toast.error("Allow this CRM to open WhatsApp, then try again.");
			return;
		}
		tab.opener = null;
		try {
			const result = await initiate.mutateAsync({ contactId, message });
			tab.location.replace(result.url);
			await cache.activity({ settle: "record" });
			setOpen(false);
			toast.success(
				"WhatsApp initiated. Press Send in WhatsApp to deliver it.",
			);
		} catch {
			tab.close();
		}
	};
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					WhatsApp
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>WhatsApp follow-up</DialogTitle>
					<DialogDescription>
						The CRM records the link click as initiated. Check your WhatsApp
						account and press Send there.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3 px-4">
					<label htmlFor={contextId} className="flex flex-col gap-1 text-sm">
						<span>Where you met</span>
						<Input
							id={contextId}
							value={meetingContext}
							onChange={(event) => setMeetingContext(event.target.value)}
							placeholder="ETCISO Annual Conclave"
						/>
					</label>
					<label htmlFor={messageId} className="flex flex-col gap-1 text-sm">
						<span>Message</span>
						<Textarea
							id={messageId}
							value={message}
							onChange={(event) => setEditedMessage(event.target.value)}
							rows={6}
							maxLength={2000}
						/>
					</label>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setEditedMessage(null)}>
						Reset suggestion
					</Button>
					<Button
						disabled={initiate.isPending || !message.trim()}
						onClick={() => void launch()}
					>
						Open WhatsApp
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
