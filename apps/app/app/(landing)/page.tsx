import { Button } from "@crm/ui/components/button";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AgentSection } from "@/components/landing/agent-section";
import { LandingAnalytics } from "@/components/landing/analytics";
import { CapabilitiesSection } from "@/components/landing/capabilities-section";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { ProductShot } from "@/components/landing/product-shot/product-shot";

async function isTerraeagleRequest() {
	return (
		(await headers()).get("host")?.split(":")[0]?.toLowerCase() ===
		"crm.terraeagle.com"
	);
}

export async function generateMetadata(): Promise<Metadata> {
	return (await isTerraeagleRequest())
		? {
				title: "Terraeagle CRM",
				description:
					"Research prospects, review outreach, and follow up from Terraeagle CRM.",
			}
		: {
				title: "The CRM for agents",
				description:
					"The first agentic CRM experience — durable research agents that read your inbox, keep every record current and book their own follow-ups.",
			};
}

function TerraeagleWelcome() {
	const steps = [
		[
			"Connect your mailbox",
			"Sign in with your Terraeagle Microsoft 365 account. Connect your inbox to track conversations and replies.",
		],
		[
			"Choose a campaign",
			"Select a service and prospects. Review company research and suggested outreach.",
		],
		[
			"Review and send",
			"Edit email drafts, choose a sender mailbox, and approve each message before sending.",
		],
		[
			"Keep the conversation moving",
			"Use the Inbox to see replies, pending actions, and follow-up reminders.",
		],
	];

	return (
		<main className="dark min-h-svh bg-background text-foreground">
			<header className="border-b border-border">
				<div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
					<span className="text-base font-semibold">Terraeagle CRM</span>
					<Button asChild size="lg">
						<Link href="/terraeagle">Access CRM</Link>
					</Button>
				</div>
			</header>
			<div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
				<p className="mb-4 text-sm font-medium text-primary">
					Terraeagle sales workspace
				</p>
				<h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
					Research, outreach, and follow-up in one place.
				</h1>
				<p className="mt-6 max-w-2xl text-lg text-muted-foreground">
					Start with a prospect or campaign. Review what agents find, approve
					your outreach, and track the next action.
				</p>
				<Button asChild size="xl" className="mt-8">
					<Link href="/terraeagle">Access CRM</Link>
				</Button>
				<h2 className="mt-20 text-2xl font-semibold">How to get started</h2>
				<ol className="mt-6 grid gap-4 sm:grid-cols-2">
					{steps.map(([title, description], index) => (
						<li
							key={title}
							className="rounded-xl border border-border bg-card p-6"
						>
							<p className="text-sm font-medium text-primary">
								Step {index + 1}
							</p>
							<h3 className="mt-3 text-lg font-semibold">{title}</h3>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{description}
							</p>
						</li>
					))}
				</ol>
			</div>
		</main>
	);
}

export default async function Home() {
	if (await isTerraeagleRequest()) return <TerraeagleWelcome />;
	return (
		<div className="dark flex min-h-svh w-full flex-col items-center overflow-clip bg-background font-sans text-foreground">
			<LandingNav />
			<Hero />
			<ProductShot />
			<AgentSection />
			<CapabilitiesSection />
			<ClosingCta />
			<LandingFooter />
			<LandingAnalytics />
		</div>
	);
}
