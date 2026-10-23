"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";

export function ResearchKey() {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const keyId = useId();
	const [draft, setDraft] = useState("");

	const key = useQuery(trpc.settings.researchKey.queryOptions());

	const save = useMutation(
		trpc.settings.setResearchKey.mutationOptions({
			onSuccess: async () => {
				await cache.settings();
				setDraft("");
				toast.success("Context API key saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const clear = useMutation(
		trpc.settings.clearResearchKey.mutationOptions({
			onSuccess: async () => {
				await cache.settings();
				setDraft("");
				toast.success("Context enrichment disabled.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!key.data) return null;

	const { configured, hint } = key.data;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Company research</CardTitle>
				<CardDescription>
					Azure research reads public company pages without Context. Add an
					optional Context key for brand and LinkedIn enrichment.
				</CardDescription>

				<CardAction className="flex gap-2">
					{configured ? (
						<Button
							type="button"
							variant="outline"
							disabled={clear.isPending || save.isPending}
							onClick={() => clear.mutate()}
						>
							Disable Context
						</Button>
					) : null}
					<Button
						type="submit"
						form="research-key"
						disabled={save.isPending || clear.isPending || draft.trim() === ""}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						{configured ? "Replace key" : "Save key"}
					</Button>
				</CardAction>
			</CardHeader>

			<CardContent>
				<form
					id="research-key"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({ apiKey: draft.trim() });
					}}
				>
					<FieldGroup>
						<Field>
							<div className="flex items-center justify-between gap-3">
								<FieldLabel htmlFor={keyId}>Context API key</FieldLabel>
								<StatusIndicator
									size="sm"
									tone={configured ? "success" : "warning"}
									label={configured ? "Connected" : "Not connected"}
								/>
							</div>
							<Input
								id={keyId}
								type="password"
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								placeholder={hint ?? "Paste the key"}
								autoComplete="off"
								autoCapitalize="off"
								autoCorrect="off"
								spellCheck={false}
								disabled={save.isPending}
							/>
							<FieldDescription>
								Public-page company research continues without this key.
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
