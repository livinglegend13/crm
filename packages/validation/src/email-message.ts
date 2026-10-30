import { z } from "zod";

export const emailMessageRecipients = z.array(
	z.object({
		email: z.email(),
		name: z.string().nullable(),
		kind: z.enum(["to", "cc"]),
	}),
);
