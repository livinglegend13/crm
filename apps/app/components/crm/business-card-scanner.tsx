"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import type { BusinessCardExtraction } from "@crm/validation/business-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

function toBase64(bytes: Uint8Array) {
	let text = "";
	for (let index = 0; index < bytes.length; index += 8192) {
		text += String.fromCharCode(...bytes.subarray(index, index + 8192));
	}
	return btoa(text);
}

export function BusinessCardScanner() {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const fileId = useId();
	const noteId = useId();
	const metId = useId();
	const sendId = useId();
	const [file, setFile] = useState<File | null>(null);
	const [note, setNote] = useState("");
	const [recentlyMet, setRecentlyMet] = useState(false);
	const [autoSend, setAutoSend] = useState(false);
	const [chatId, setChatId] = useState<string | null>(null);
	const list = useQuery({
		...trpc.businessCards.list.queryOptions(),
		refetchInterval: 3000,
	});
	const create = useMutation(
		trpc.conversations.createBuilder.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);
	const scan = async () => {
		if (!file) return;
		if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
			toast.error("Choose a JPEG, PNG, or WebP photo.");
			return;
		}
		if (file.size < 1 || file.size > 2_000_000) {
			toast.error("Choose a photo smaller than 2 MB.");
			return;
		}
		const contentBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));
		const response = await create.mutateAsync({
			clientRequestId: crypto.randomUUID(),
			commandType: "CHAT",
			message: `Business card capture request\n${JSON.stringify({ recentlyMet, autoSend: autoSend && recentlyMet, meetingNote: note.trim() || null })}\nRead the attached card. Stage visible contact and company details for review. Do not create a contact or send email yet.`,
			resources: [],
			attachments: [
				{ name: file.name, type: file.type, size: file.size, contentBase64 },
			],
		});
		setChatId(response.id);
		setFile(null);
		toast.success(
			"The card scan started. Review its details below when ready.",
		);
	};
	return (
		<main className="min-h-0 flex-1 overflow-y-auto p-6">
			<div className="mx-auto flex max-w-4xl flex-col gap-6">
				<div>
					<h1 className="text-2xl font-semibold">Scan business cards</h1>
					<p className="text-muted-foreground">
						Photograph a card, review the details, and save the contact.
					</p>
				</div>
				<section className="flex flex-col gap-4 rounded-lg border p-5">
					<label htmlFor={fileId} className="font-medium">
						Card photo
					</label>
					<Input
						id={fileId}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						capture="environment"
						onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					/>
					<label htmlFor={noteId} className="font-medium">
						Meeting note
					</label>
					<Textarea
						id={noteId}
						value={note}
						onChange={(event) => setNote(event.target.value)}
						maxLength={5000}
						placeholder="Where you met, what you discussed, and any promised follow-up"
					/>
					<label htmlFor={metId} className="flex items-center gap-2">
						<Checkbox
							id={metId}
							checked={recentlyMet}
							onCheckedChange={(value) => {
								setRecentlyMet(value === true);
								if (value !== true) setAutoSend(false);
							}}
						/>
						Recently met this contact
					</label>
					<label htmlFor={sendId} className="flex items-center gap-2">
						<Checkbox
							id={sendId}
							checked={autoSend}
							disabled={!recentlyMet}
							onCheckedChange={(value) => setAutoSend(value === true)}
						/>
						Send a thank-you automatically after email verification
					</label>
					<p className="text-muted-foreground text-sm">
						Automatic email uses your Microsoft 365 mailbox. Review the
						extracted address before saving.
					</p>
					<div>
						<Button
							disabled={!file || create.isPending}
							onClick={() => void scan()}
						>
							{create.isPending ? "Starting scan…" : "Scan card"}
						</Button>
					</div>
					{chatId ? (
						<Link
							href={workspaceUrl(`/chat/${chatId}`)}
							className="text-primary underline"
						>
							View scan progress in chat
						</Link>
					) : null}
				</section>
				<section className="flex flex-col gap-4">
					<h2 className="text-lg font-semibold">Card scans</h2>
					{list.data?.length ? (
						list.data.map((row) => <ReviewCard key={row.id} row={row} />)
					) : (
						<p className="text-muted-foreground">No card scans yet.</p>
					)}
				</section>
			</div>
		</main>
	);
}

function ReviewCard({
	row,
}: {
	row: RouterOutputs["businessCards"]["list"][number];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [extraction, setExtraction] = useState<BusinessCardExtraction>({
		...row.extraction,
		countryCode: row.extraction.countryCode ?? "IN",
	});
	const [meetingNote, setMeetingNote] = useState(row.meetingNote ?? "");
	const [recentlyMet, setRecentlyMet] = useState(row.recentlyMet);
	const [autoSend, setAutoSend] = useState(row.autoSend);
	const [existingContactId, setExistingContactId] = useState<string | null>(
		null,
	);
	const confirm = useMutation(
		trpc.businessCards.confirm.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.businessCards.list.pathKey(),
				});
				toast.success("Contact saved to the conference campaign.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const field = (key: keyof BusinessCardExtraction, label: string) => (
		<label
			key={key}
			htmlFor={`${row.id}-${key}`}
			className="flex flex-col gap-1 text-sm"
		>
			<span>{label}</span>
			<Input
				id={`${row.id}-${key}`}
				value={extraction[key] ?? ""}
				onChange={(event) =>
					setExtraction((current) => ({
						...current,
						[key]: event.target.value,
					}))
				}
			/>
		</label>
	);
	return (
		<div className="flex flex-col gap-4 rounded-lg border p-5">
			<div className="flex items-center justify-between gap-3">
				<h3 className="font-medium">
					{row.extraction.firstName} {row.extraction.lastName ?? ""} ·{" "}
					{row.extraction.companyName}
				</h3>
				<span className="text-muted-foreground text-sm">{row.status}</span>
			</div>
			{row.status === "REVIEW" ? (
				<>
					{row.matchCandidates.length ? (
						<div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
							<p className="font-medium">Possible existing contacts</p>
							<p className="text-muted-foreground">
								Choose a contact to add the meeting note to its record. A
								matching email always reuses its existing record.
							</p>
							{row.matchCandidates.map((match) => (
								<Button
									key={match.id}
									variant={
										existingContactId === match.id ? "secondary" : "outline"
									}
									className="justify-start"
									onClick={() => setExistingContactId(match.id)}
								>
									{match.name} · {match.companyName} ·{" "}
									{match.email ?? match.reason}
								</Button>
							))}
							<Button
								variant="ghost"
								className="justify-start"
								onClick={() => setExistingContactId(null)}
							>
								Create a new contact when the email differs
							</Button>
						</div>
					) : null}
					<div className="grid gap-3 sm:grid-cols-2">
						{field("firstName", "First name")}
						{field("lastName", "Last name")}
						{field("companyName", "Company")}
						{field("email", "Work email")}
						{field("phone", "Phone")}
						{field("title", "Title")}
						{field("website", "Website")}
						{field("countryCode", "Country code")}
					</div>
					<label
						htmlFor={`${row.id}-note`}
						className="flex flex-col gap-1 text-sm"
					>
						<span>Meeting note</span>
						<Textarea
							id={`${row.id}-note`}
							value={meetingNote}
							onChange={(event) => setMeetingNote(event.target.value)}
							maxLength={5000}
						/>
					</label>
					<label htmlFor={`${row.id}-met`} className="flex items-center gap-2">
						<Checkbox
							id={`${row.id}-met`}
							checked={recentlyMet}
							onCheckedChange={(value) => {
								setRecentlyMet(value === true);
								if (value !== true) setAutoSend(false);
							}}
						/>
						Recently met
					</label>
					<label htmlFor={`${row.id}-send`} className="flex items-center gap-2">
						<Checkbox
							id={`${row.id}-send`}
							checked={autoSend}
							disabled={!recentlyMet}
							onCheckedChange={(value) => setAutoSend(value === true)}
						/>
						Send thank-you automatically
					</label>
					<div>
						<Button
							disabled={confirm.isPending}
							onClick={() =>
								confirm.mutate({
									id: row.id,
									existingContactId,
									extraction: {
										...extraction,
										lastName: extraction.lastName || null,
										email: extraction.email || null,
										phone: extraction.phone || null,
										title: extraction.title || null,
										website: extraction.website || null,
										countryCode: extraction.countryCode || null,
									},
									meetingNote: meetingNote.trim() || null,
									recentlyMet,
									autoSend: autoSend && recentlyMet,
								})
							}
						>
							Save contact
						</Button>
					</div>
				</>
			) : (
				<div className="flex flex-wrap gap-4 text-sm">
					{row.contactId ? (
						<Link
							href={workspaceUrl(`/contacts?record=contact:${row.contactId}`)}
							className="text-primary underline"
						>
							Open contact
						</Link>
					) : null}
					{row.campaignId ? (
						<Link
							href={workspaceUrl(`/outreach/campaigns/${row.campaignId}`)}
							className="text-primary underline"
						>
							Open campaign
						</Link>
					) : null}
					{row.sendError ? (
						<p className="text-destructive">{row.sendError}</p>
					) : null}
				</div>
			)}
		</div>
	);
}
