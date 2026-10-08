import type * as React from "react";

export type WorkflowNodeState = "waiting" | "running" | "ready" | "complete" | "attention";

const STATE_CLASSES: Record<WorkflowNodeState, string> = {
	waiting: "border-border text-muted-foreground",
	running: "border-primary text-foreground",
	ready: "border-ring text-foreground",
	complete: "border-primary/40 text-foreground",
	attention: "border-destructive text-foreground",
};

const DOT_CLASSES: Record<WorkflowNodeState, string> = {
	waiting: "bg-muted-foreground/50",
	running: "bg-primary animate-pulse motion-reduce:animate-none",
	ready: "bg-primary",
	complete: "bg-primary",
	attention: "bg-destructive",
};

export function WorkflowNode({
	step,
	title,
	description,
	state,
	selected,
	...props
}: React.ComponentProps<"button"> & {
	step: string;
	title: string;
	description: string;
	state: WorkflowNodeState;
	selected: boolean;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			data-state={state}
			className={`flex min-h-32 w-44 shrink-0 flex-col rounded-lg border bg-card p-3 text-left outline-none transition-[border-color,background-color,box-shadow] hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60 aria-pressed:ring-2 aria-pressed:ring-ring/50 ${STATE_CLASSES[state]}`}
			{...props}
		>
			<span className="flex items-center gap-2 text-xs">
				<span className={`size-2 rounded-full ${DOT_CLASSES[state]}`} aria-hidden />
				{step}
			</span>
			<strong className="mt-3 text-sm text-foreground">{title}</strong>
			<span className="mt-1 line-clamp-2 text-xs">{description}</span>
			<span className="mt-auto pt-2 font-mono text-[11px] capitalize">{state}</span>
		</button>
	);
}

export function WorkflowConnector({ active }: { active: boolean }) {
	return (
		<span aria-hidden className="relative h-0.5 w-10 shrink-0 bg-border">
			{active ? <span className="workflow-connector-packet absolute top-1/2 left-0 size-2 -translate-y-1/2 rounded-full bg-primary motion-reduce:hidden" /> : null}
		</span>
	);
}
