import { Injectable } from "@nestjs/common";
import {
	MailboxApiClient,
	type MailboxResult,
} from "../mailbox/mailbox-api.client";

const BASE = "https://graph.microsoft.com/v1.0/me";

function mailboxBase(mailbox?: string): string {
	return mailbox
		? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}`
		: BASE;
}

const MESSAGE_FIELDS = [
	"id",
	"internetMessageId",
	"conversationId",
	"subject",
	"from",
	"sender",
	"toRecipients",
	"ccRecipients",
	"receivedDateTime",
	"sentDateTime",
	"body",
	"bodyPreview",
	"internetMessageHeaders",
	"parentFolderId",
	"webLink",
].join(",");

export type GraphAddress = {
	emailAddress?: { name?: string; address?: string };
};

export type GraphMessage = {
	id?: string;
	internetMessageId?: string;
	conversationId?: string;
	subject?: string | null;
	from?: GraphAddress;
	sender?: GraphAddress;
	toRecipients?: GraphAddress[];
	ccRecipients?: GraphAddress[];
	receivedDateTime?: string;
	sentDateTime?: string;
	body?: { contentType?: string; content?: string };
	bodyPreview?: string;
	internetMessageHeaders?: { name?: string; value?: string }[];
	parentFolderId?: string;
	webLink?: string;
};

export type MessagePage = {
	value?: GraphMessage[];
	"@odata.nextLink"?: string;
};

export type GraphUser = {
	mail?: string | null;
	userPrincipalName?: string | null;
};

export type GraphFolder = {
	id?: string;
};

@Injectable()
export class GraphClient {
	constructor(private readonly api: MailboxApiClient) {}

	async sendMail(
		accessToken: string,
		message: {
			from: string;
			to: string;
			subject: string;
			body: string;
		},
	): Promise<"accepted" | "rejected" | "unknown"> {
		try {
			const response = await fetch(`${BASE}/sendMail`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: {
						subject: message.subject,
						body: { contentType: "Text", content: message.body },
						from: { emailAddress: { address: message.from } },
						toRecipients: [{ emailAddress: { address: message.to } }],
					},
					saveToSentItems: true,
				}),
				signal: AbortSignal.timeout(30_000),
			});
			if (response.status === 202) return "accepted";
			if ([400, 401, 403, 404, 422].includes(response.status))
				return "rejected";
			return "unknown";
		} catch {
			return "unknown";
		}
	}

	async me(accessToken: string): Promise<MailboxResult<GraphUser>> {
		return this.api.get<GraphUser>(BASE, accessToken, {
			$select: "mail,userPrincipalName",
		});
	}

	async folder(
		accessToken: string,
		wellKnownName: string,
		mailbox?: string,
	): Promise<MailboxResult<GraphFolder>> {
		return this.api.get<GraphFolder>(
			`${mailboxBase(mailbox)}/mailFolders/${wellKnownName}`,
			accessToken,
			{ $select: "id" },
		);
	}

	async listMessages(
		accessToken: string,
		options: { after: Date; top: number },
		mailbox?: string,
	): Promise<MailboxResult<MessagePage>> {
		return this.api.get<MessagePage>(
			`${mailboxBase(mailbox)}/messages`,
			accessToken,
			{
				$select: MESSAGE_FIELDS,
				$filter: `receivedDateTime gt ${options.after.toISOString()} and isDraft eq false`,
				$orderby: "receivedDateTime asc",
				$top: options.top,
			},
		);
	}

	async nextPage(
		accessToken: string,
		nextLink: string,
	): Promise<MailboxResult<MessagePage>> {
		return this.api.get<MessagePage>(nextLink, accessToken);
	}
}
