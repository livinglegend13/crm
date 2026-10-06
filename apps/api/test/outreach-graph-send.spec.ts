import { afterEach, describe, expect, it } from "bun:test";
import { GraphClient } from "../src/microsoft/graph.client";

const originalFetch = globalThis.fetch;
const graph = new GraphClient(
	{} as ConstructorParameters<typeof GraphClient>[0],
);
const message = {
	from: "rep@mailx.terraeagle.com",
	to: "buyer@example.com",
	subject: "Storage review",
	body: "Hello from Terraeagle.",
};

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("approved outreach Graph send", () => {
	it("reads each delegated sender mailbox through its own Graph path", async () => {
		const paths: string[] = [];
		const client = new GraphClient({
			get: async (url: string) => {
				paths.push(url);
				return { outcome: "ok", data: { value: [] } };
			},
		} as unknown as ConstructorParameters<typeof GraphClient>[0]);
		await client.listMessages(
			"token",
			{ after: new Date("2026-10-01T00:00:00Z"), top: 10 },
			"rep@mailx.terraeagle.com",
		);
		expect(paths).toEqual([
			"https://graph.microsoft.com/v1.0/users/rep%40mailx.terraeagle.com/messages",
		]);
	});

	it("sends only the selected sender and recipient", async () => {
		let request: Request | undefined;
		globalThis.fetch = (async (input, init) => {
			request = new Request(input.toString(), init);
			return new Response(null, { status: 202 });
		}) as typeof fetch;

		expect(await graph.sendMail("token", message)).toBe("accepted");
		expect(request?.url).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
		expect(request?.method).toBe("POST");
		const payload = (await request?.json()) as {
			message: {
				from: { emailAddress: { address: string } };
				toRecipients: { emailAddress: { address: string } }[];
			};
			saveToSentItems: boolean;
		};
		expect(payload.message.from.emailAddress.address).toBe(message.from);
		expect(payload.message.toRecipients).toEqual([
			{ emailAddress: { address: message.to } },
		]);
		expect(payload.saveToSentItems).toBe(true);
	});

	it("returns a definite rejection for missing Send As access", async () => {
		globalThis.fetch = (async () =>
			new Response(null, { status: 403 })) as unknown as typeof fetch;
		expect(await graph.sendMail("token", message)).toBe("rejected");
	});

	it("blocks automatic retry after an uncertain network result", async () => {
		globalThis.fetch = (async () => {
			throw new Error("Connection closed after request submission");
		}) as unknown as typeof fetch;
		expect(await graph.sendMail("token", message)).toBe("unknown");
	});
});
