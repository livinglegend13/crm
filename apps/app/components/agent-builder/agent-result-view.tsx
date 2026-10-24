"use client";

import { Markdown } from "@crm/ui/components/markdown";

type ResultValue =
	| string
	| number
	| boolean
	| null
	| ResultValue[]
	| { [key: string]: ResultValue };

function label(key: string) {
	return key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replaceAll("_", " ")
		.replace(/^./, (letter) => letter.toUpperCase());
}

function Value({ value }: { value: ResultValue }) {
	if (value === null)
		return <span className="text-muted-foreground">Not provided</span>;
	if (typeof value === "string")
		return (
			<Markdown className="text-sm">{value.replaceAll("\\n", "\n")}</Markdown>
		);
	if (typeof value !== "object") return <span>{String(value)}</span>;
	if (Array.isArray(value)) {
		const occurrences = new Map<string, number>();
		return value.length ? (
			<ol className="flex list-decimal flex-col gap-3 pl-5">
				{value.map((item) => {
					const text = JSON.stringify(item);
					const count = occurrences.get(text) ?? 0;
					occurrences.set(text, count + 1);
					return (
						<li key={`${text}:${count}`} className="pl-1">
							<Value value={item} />
						</li>
					);
				})}
			</ol>
		) : (
			<span className="text-muted-foreground">None</span>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{Object.entries(value).map(([key, item]) => (
				<div key={key} className="min-w-0">
					<div className="font-medium text-muted-foreground text-xs">
						{label(key)}
					</div>
					<div className="mt-1 wrap-break-word text-sm">
						<Value value={item} />
					</div>
				</div>
			))}
		</div>
	);
}

export function AgentResultView({
	result,
}: {
	result: Record<string, ResultValue>;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-5">
			{Object.entries(result).map(([key, value]) => (
				<section
					key={key}
					className="min-w-0 border-t pt-4 first:border-t-0 first:pt-0"
				>
					<h4 className="mb-2 font-medium text-sm">{label(key)}</h4>
					<Value value={value} />
				</section>
			))}
		</div>
	);
}
