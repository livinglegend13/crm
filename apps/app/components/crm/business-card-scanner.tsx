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

function whatsappNumber(phone: string | null, countryCode: string | null) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, "");
	if (phone.trim().startsWith("+")) return digits.length >= 10 ? digits : null;
	if (countryCode?.toUpperCase() === "IN" && digits.length === 10)
		return `91${digits}`;
	return digits.length > 10 ? digits : null;
}

async function compressCardPhoto(file: File) {
	if (file.size > 40_000_000) {
		throw new Error("Choose a camera photo smaller than 40 MB.");
	}
	const bitmap = await createImageBitmap(file);
	const canvas = document.createElement("canvas");
	try {
		for (const edge of [1800, 1500, 1200]) {
			const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
			canvas.width = Math.max(1, Math.round(bitmap.width * scale));
			canvas.height = Math.max(1, Math.round(bitmap.height * scale));
			const context = canvas.getContext("2d");
			if (!context) throw new Error("The browser cannot prepare this photo.");
			context.fillStyle = "white";
			context.fillRect(0, 0, canvas.width, canvas.height);
			context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			for (const quality of [0.85, 0.7, 0.55]) {
				const blob = await new Promise<Blob | null>((resolve) =>
					canvas.toBlob(resolve, "image/jpeg", quality),
				);
				if (blob && blob.size <= 1_800_000) {
					return new Uint8Array(await blob.arrayBuffer());
				}
			}
			canvas.width = 0;
			canvas.height = 0;
		}
		throw new Error(
			"The photo remains too large after resizing. Try another photo.",
		);
	} finally {
		bitmap.close();
		canvas.width = 0;
		canvas.height = 0;
	}
}

export function BusinessCardScanner() {
	const trpc = useTRPC();
	const fileId = useId();
	const noteId = useId();
	const metId = useId();
	const sendId = useId();
	const [file, setFile] = useState<File | null>(null);
	const [note, setNote] = useState("");
	const [recentlyMet, setRecentlyMet] = useState(false);
	const [autoSend, setAutoSend] = useState(false);
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
		if (!file.type.startsWith("image/")) {
			toast.error("Choose a camera photo or image.");
			return;
		}
		if (file.size < 1) {
			toast.error("This photo is empty.");
			return;
		}
		let bytes: Uint8Array;
		try {
			bytes = await compressCardPhoto(file);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "This photo cannot be resized.",
			);
			return;
		}
		const contentBase64 = toBase64(bytes);
		await create.mutateAsync({
			clientRequestId: crypto.randomUUID(),
			commandType: "CHAT",
			message: `Business card capture request\n${JSON.stringify({ recentlyMet, autoSend: autoSend && recentlyMet, meetingNote: note.trim() || null })}\nRead the attached card. Stage visible contact and company details for review. Do not create a contact or send email yet.`,
			resources: [],
			attachments: [
				{
					name: "business-card.jpg",
					type: "image/jpeg",
					size: bytes.length,
					contentBase64,
				},
			],
		});
		setFile(null);
		toast.success(
			"The card scan started. Stay here to review the contact and email below.",
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
						accept="image/*"
						capture="environment"
						onChange={(event) => {
							setFile(event.target.files?.[0] ?? null);
							event.currentTarget.value = "";
						}}
					/>
					<p className="text-muted-foreground text-sm">
						Large photos are resized before upload. The stored card photo is
						removed after successful extraction.
					</p>
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
						Send a thank-you automatically after saving
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
					{create.isSuccess ? (
						<p className="text-muted-foreground text-sm">
							The scanned card appears below. Check its details and email, then
							select Save contact. The CRM sends after saving when you selected
							automatic sending.
						</p>
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
	const [subject, setSubject] = useState(row.subject);
	const [body, setBody] = useState(row.body);
	const [whatsappBody, setWhatsappBody] = useState(
		`Hi ${row.extraction.firstName}, it was great meeting you. I enjoyed our conversation and would like to explore potential collaboration. Would you be open to a short call next week? Regards, Terraeagle`,
	);
	const [checkedSentItems, setCheckedSentItems] = useState(false);
	const [existingContactId, setExistingContactId] = useState<string | null>(
		null,
	);
	const messageDirty = subject !== row.subject || body !== row.body;
	const confirm = useMutation(
		trpc.businessCards.confirm.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.businessCards.list.pathKey(),
				});
				toast.success(
					result.status === "SENT"
						? "Contact saved. Microsoft accepted the thank-you email."
						: "Contact saved to the conference campaign.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const editMessage = useMutation(
		trpc.businessCards.editMessage.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.businessCards.list.pathKey(),
				});
				toast.success("Thank-you email saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const requestSend = useMutation(
		trpc.businessCards.requestSend.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.businessCards.list.pathKey(),
				});
				toast.success(
					result.status === "SENT"
						? "Microsoft accepted the email."
						: "Email queued. Sending status appears here.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const retryUnknown = useMutation(
		trpc.businessCards.retryUnknown.mutationOptions({
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.businessCards.list.pathKey(),
				});
				toast[result.status === "SENT" ? "success" : "error"](
					result.status === "SENT"
						? "Microsoft accepted the retry. Check Sent Items for delivery."
						: "Microsoft did not confirm the retry. Check the card status.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const phone = whatsappNumber(extraction.phone, extraction.countryCode);
	const messageFields = (disabled: boolean) => (
		<div className="flex flex-col gap-3">
			<label
				htmlFor={`${row.id}-subject`}
				className="flex flex-col gap-1 text-sm"
			>
				<span>Thank-you email subject</span>
				<Input
					id={`${row.id}-subject`}
					value={subject}
					onChange={(event) => setSubject(event.target.value)}
					maxLength={200}
					disabled={disabled}
				/>
			</label>
			<label htmlFor={`${row.id}-body`} className="flex flex-col gap-1 text-sm">
				<span>Thank-you email</span>
				<Textarea
					id={`${row.id}-body`}
					value={body}
					onChange={(event) => setBody(event.target.value)}
					maxLength={10000}
					rows={9}
					disabled={disabled}
				/>
			</label>
		</div>
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
			<p className="text-muted-foreground text-sm">From: {row.senderEmail}</p>
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
						Send the edited email after saving
					</label>
					{messageFields(false)}
					<div>
						<Button
							disabled={confirm.isPending || !subject.trim() || !body.trim()}
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
									subject,
									body,
								})
							}
						>
							{autoSend && recentlyMet
								? "Save contact and send thank-you"
								: "Save contact"}
						</Button>
					</div>
				</>
			) : (
				<div className="flex flex-col gap-4 text-sm">
					{row.extraction.email ? (
						<p>Recipient: {row.extraction.email}</p>
					) : (
						<p className="text-muted-foreground">
							No email address was found on this card.
						</p>
					)}
					{messageFields(row.status !== "SAVED")}
					{row.status === "SAVED" ? (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								disabled={
									!messageDirty ||
									editMessage.isPending ||
									!subject.trim() ||
									!body.trim()
								}
								onClick={() =>
									editMessage.mutate({ id: row.id, subject, body })
								}
							>
								Save email
							</Button>
							<Button
								disabled={
									!row.recentlyMet ||
									!row.extraction.email ||
									messageDirty ||
									requestSend.isPending
								}
								onClick={() => requestSend.mutate({ id: row.id })}
							>
								Send thank-you email
							</Button>
							{!row.recentlyMet ? (
								<p className="text-muted-foreground">
									Mark the contact as recently met during review to send a
									thank-you.
								</p>
							) : null}
							{messageDirty ? (
								<p className="text-muted-foreground">
									Save your email edits before sending.
								</p>
							) : null}
						</div>
					) : null}
					{row.status === "PENDING_SEND" ||
					row.status === "PENDING_VERIFICATION" ? (
						<p>Waiting for Microsoft 365 to accept the email.</p>
					) : null}
					{row.status === "SENT" ? (
						<p>
							Sent{" "}
							{row.sentAt ? new Date(row.sentAt).toLocaleString("en-IN") : ""}
						</p>
					) : null}
					{row.status === "SEND_UNKNOWN" ? (
						<div className="flex flex-col gap-3 rounded-lg border p-3">
							<p>
								Microsoft did not confirm this email. Check your Sent Items
								before retrying.
							</p>
							<label
								htmlFor={`${row.id}-sent-check`}
								className="flex items-center gap-2"
							>
								<Checkbox
									id={`${row.id}-sent-check`}
									checked={checkedSentItems}
									onCheckedChange={(value) =>
										setCheckedSentItems(value === true)
									}
								/>
								I checked Sent Items. This email is absent.
							</label>
							<Button
								variant="outline"
								disabled={!checkedSentItems || retryUnknown.isPending}
								onClick={() => retryUnknown.mutate({ id: row.id })}
							>
								Retry email once
							</Button>
						</div>
					) : null}
					{row.recentlyMet ? (
						<div className="flex flex-col gap-3 rounded-lg border p-3">
							<label htmlFor={`${row.id}-whatsapp`} className="font-medium">
								WhatsApp follow-up
							</label>
							<Textarea
								id={`${row.id}-whatsapp`}
								value={whatsappBody}
								onChange={(event) => setWhatsappBody(event.target.value)}
								maxLength={2000}
								rows={4}
							/>
							{phone ? (
								<Button asChild variant="outline">
									<a
										href={`https://wa.me/${phone}?text=${encodeURIComponent(whatsappBody)}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										Open WhatsApp to review and send
									</a>
								</Button>
							) : (
								<p className="text-muted-foreground">
									Add the contact phone in international format to open
									WhatsApp.
								</p>
							)}
							<p className="text-muted-foreground">
								WhatsApp opens on your device. Review the sender account and
								press Send there.
							</p>
						</div>
					) : null}
					<div className="flex flex-wrap gap-4">
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
				</div>
			)}
		</div>
	);
}
