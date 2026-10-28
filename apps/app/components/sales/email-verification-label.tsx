"use client";

import { StatusIndicator } from "@crm/ui/components/status-indicator";
import type { RouterOutputs } from "@/lib/trpc/types";

type Verification = RouterOutputs["salesIntegrations"]["verificationStatus"];

export function EmailVerificationLabel({
	verification,
	loading,
}: {
	verification: Verification | undefined;
	loading: boolean;
}) {
	if (loading)
		return (
			<StatusIndicator
				tone="info"
				busy
				label="Checking email status"
				size="sm"
			/>
		);
	if (!verification || verification.state === "NO_EMAIL") return null;
	if (verification.state === "NO_CONTACT")
		return (
			<StatusIndicator
				tone="warning"
				label="Add this address as a CRM contact for automatic verification"
				size="sm"
			/>
		);
	if (verification.state === "PENDING")
		return (
			<StatusIndicator
				tone="info"
				label="Awaiting automatic Reoon check"
				size="sm"
			/>
		);
	if (verification.state === "CHECKING")
		return (
			<StatusIndicator
				tone="info"
				busy
				label="Reoon verification in progress"
				size="sm"
			/>
		);
	if (verification.state === "FAILED")
		return (
			<StatusIndicator
				tone="warning"
				label="Reoon check failed. The CRM retries automatically."
				size="sm"
			/>
		);
	if (verification.state === "UNSAFE")
		return (
			<StatusIndicator
				tone="error"
				label={`Do not send · Reoon ${verification.status ?? "unsafe"}`}
				size="sm"
			/>
		);
	return (
		<StatusIndicator
			tone="success"
			label={`Safe to send · Reoon ${verification.status ?? "safe"}${verification.score === null ? "" : ` · ${verification.score}/100`}`}
			size="sm"
		/>
	);
}
