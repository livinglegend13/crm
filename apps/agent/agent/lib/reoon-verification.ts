import { db } from "@crm/db";
import { PRIORITY } from "@crm/db/agent-tasks";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { REOON, reoonResult } from "@crm/validation/reoon";
import { z } from "zod";
import { reoonKey } from "./reoon-key";

const candidateRows = z.array(z.object({ id: z.string(), email: z.string() }));

export async function queueAutomaticEmailVerifications(): Promise<number> {
	if (!(await reoonKey())) return 0;
	const now = new Date();
	const staleBefore = new Date(now.getTime() - REOON.maximumAgeMs);
	const retryAfter = new Date(now.getTime() - REOON.retryDelayMs);
	const recent = await db.agentTask.count({
		where: {
			kind: "email-verify",
			createdAt: { gte: new Date(now.getTime() - REOON.dayMs) },
		},
	});
	const available = Math.min(REOON.queuePerTick, REOON.maxPerDay - recent);
	if (available <= 0) return 0;
	const candidates = candidateRows.parse(
		await db.$queryRaw`
		SELECT c."id", c."email"
		FROM "contact" c
		LEFT JOIN "emailVerification" v ON v."contactId" = c."id"
		WHERE c."archivedAt" IS NULL
			AND c."email" IS NOT NULL
			AND c."email" LIKE '%@%.%'
			AND (v."contactId" IS NULL OR lower(v."email") <> lower(c."email") OR v."checkedAt" < ${staleBefore})
			AND NOT EXISTS (
				SELECT 1 FROM "agentTask" t
				WHERE t."contactId" = c."id"
					AND t."kind" = 'email-verify'
					AND (t."finishedAt" IS NULL OR t."createdAt" >= ${retryAfter})
			)
		ORDER BY c."createdAt" DESC
		LIMIT ${available}
	`,
	);
	let queued = 0;
	for (const candidate of candidates) {
		if (!z.email().safeParse(candidate.email).success) continue;
		const created = await db.$transaction(async (tx) => {
			await lockIdempotencyKey(tx, `agent-task:email-verify:${candidate.id}::`);
			const pending = await tx.agentTask.findFirst({
				where: {
					contactId: candidate.id,
					kind: "email-verify",
					finishedAt: null,
				},
				select: { id: true },
			});
			if (pending) return false;
			await tx.agentTask.create({
				data: {
					contactId: candidate.id,
					kind: "email-verify",
					reason: "Automatically verify contact email",
					priority: PRIORITY.emailVerify,
					budget: 1,
					dueAt: now,
				},
			});
			return true;
		});
		if (created) queued += 1;
	}
	return queued;
}

export async function verifyContactEmail(contactId: string): Promise<string> {
	const key = await reoonKey();
	if (!key)
		return "Reoon is not configured. Email verification is unavailable.";
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: { email: true },
	});
	if (!contact?.email) return "Contact has no email address to verify.";
	const email = contact.email.trim().toLowerCase();
	const url = new URL("https://emailverifier.reoon.com/api/v1/verify");
	url.searchParams.set("email", email);
	url.searchParams.set("key", key);
	url.searchParams.set("mode", "power");
	const response = await fetch(url, {
		signal: AbortSignal.timeout(REOON.timeoutMs),
	});
	if (!response.ok)
		throw new Error(`Reoon verification failed with HTTP ${response.status}.`);
	const result = reoonResult.parse(await response.json());
	if (result.email.toLowerCase() !== email)
		throw new Error("Reoon returned another email address.");
	const safe = result.status.toLowerCase() === "safe" && result.is_safe_to_send;
	const current = await db.contact.findUnique({
		where: { id: contactId },
		select: { email: true },
	});
	if (current?.email?.trim().toLowerCase() !== email)
		return "Contact email changed during verification. Result discarded.";
	await db.emailVerification.upsert({
		where: { contactId },
		create: {
			contactId,
			email,
			status: result.status,
			score: result.overall_score ?? null,
			safe,
		},
		update: {
			email,
			status: result.status,
			score: result.overall_score ?? null,
			safe,
			checkedAt: new Date(),
		},
	});
	return `Reoon status: ${result.status}. Safe to send: ${safe}.`;
}
