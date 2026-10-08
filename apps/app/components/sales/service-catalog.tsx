"use client";

import { Button } from "@crm/ui/components/button";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { Textarea } from "@crm/ui/components/textarea";
import { marketName } from "@crm/validation/gtm-market";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Services = RouterOutputs["gtm"]["services"];
type Service = Services[number];

function ServiceForm({
	service,
	onSave,
}: {
	service?: Service;
	onSave: (value: {
		id?: string;
		name: string;
		description: string;
		qualificationGuidance: string;
		marketCountryCodes: string[];
		active: boolean;
	}) => void;
}) {
	const [name, setName] = useState(service?.name ?? "");
	const [description, setDescription] = useState(service?.description ?? "");
	const [qualificationGuidance, setQualificationGuidance] = useState(
		service?.qualificationGuidance ?? "",
	);
	const [countries, setCountries] = useState(
		service?.marketCountryCodes.join(", ") ?? "IN",
	);
	const [active, setActive] = useState(service?.active ?? true);
	return (
		<form
			className="space-y-3 rounded-lg border bg-card p-5"
			onSubmit={(event) => {
				event.preventDefault();
				onSave({
					id: service?.id,
					name: name.trim(),
					description: description.trim(),
					qualificationGuidance: qualificationGuidance.trim(),
					marketCountryCodes: [
						...new Set(
							countries
								.split(",")
								.map((code) => code.trim().toUpperCase())
								.filter(Boolean),
						),
					],
					active,
				});
			}}
		>
			<h3 className="font-medium">{service?.name ?? "Add service"}</h3>
			<div className="space-y-1">
				<Label htmlFor={`service-name-${service?.id ?? "new"}`}>Name</Label>
				<Input
					id={`service-name-${service?.id ?? "new"}`}
					value={name}
					onChange={(event) => setName(event.target.value)}
					required
					maxLength={120}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor={`service-description-${service?.id ?? "new"}`}>
					What Terraeagle sells
				</Label>
				<Textarea
					id={`service-description-${service?.id ?? "new"}`}
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					maxLength={3000}
					rows={2}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor={`service-guidance-${service?.id ?? "new"}`}>
					Qualification and research guidance
				</Label>
				<Textarea
					id={`service-guidance-${service?.id ?? "new"}`}
					value={qualificationGuidance}
					onChange={(event) => setQualificationGuidance(event.target.value)}
					maxLength={3000}
					rows={3}
				/>
			</div>
			<div className="space-y-1">
				<Label htmlFor={`service-countries-${service?.id ?? "new"}`}>
					Available countries
				</Label>
				<Input
					id={`service-countries-${service?.id ?? "new"}`}
					value={countries}
					onChange={(event) => setCountries(event.target.value)}
					placeholder="IN, AE, SA"
					required
				/>
				<p className="text-muted-foreground text-xs">
					Use two-letter country codes. Current markets:{" "}
					{countries
						.split(",")
						.map((code) => code.trim().toUpperCase())
						.filter((code) => code.length === 2)
						.map(marketName)
						.join(", ") || "none"}
					.
				</p>
			</div>
			{service ? (
				<div className="flex items-center gap-2 text-sm">
					<Checkbox
						id={`service-active-${service.id}`}
						checked={active}
						onCheckedChange={(value) => setActive(value === true)}
					/>
					<Label htmlFor={`service-active-${service.id}`}>
						Available for new campaigns
					</Label>
				</div>
			) : null}
			<Button type="submit">{service ? "Save service" : "Add service"}</Button>
		</form>
	);
}

export function ServiceCatalog({
	initialServices,
}: {
	initialServices: Services;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const services = useQuery({
		...trpc.gtm.services.queryOptions(),
		initialData: initialServices,
	});
	const save = useMutation(
		trpc.gtm.saveService.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.gtm.services.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.gtm.campaigns.pathKey(),
					}),
				]);
				toast.success("Service saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	return (
		<div className="space-y-5">
			<p className="text-muted-foreground text-sm">
				Admins manage services and country availability. Campaigns keep their
				saved plans.
			</p>
			<ServiceForm onSave={(value) => save.mutate(value)} />
			<div className="grid gap-4 xl:grid-cols-2">
				{services.data?.map((service) => (
					<ServiceForm
						key={service.id}
						service={service}
						onSave={(value) => save.mutate(value)}
					/>
				))}
			</div>
		</div>
	);
}
