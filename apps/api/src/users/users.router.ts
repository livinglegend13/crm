import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import { UsersService } from "./users.service";

const usersListOutput = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	}),
);

@Router({ alias: "users" })
@UseMiddlewares(AuthMiddleware)
export class UsersRouter {
	constructor(
		@Inject(UsersService) private readonly users: UsersService,
		@Inject(AuthService) private readonly auth: AuthService,
	) {}

	@Query()
	async me(@Ctx() ctx: AuthedTrpcContext) {
		return this.auth.getProfile(ctx.user.id);
	}

	@Query({ output: z.string() })
	async emailSignature(@Ctx() ctx: AuthedTrpcContext) {
		return this.users.emailSignature(ctx.user.id);
	}

	@Mutation({
		input: z.object({ signature: z.string().max(4000) }),
		output: z.string(),
	})
	async setEmailSignature(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: { signature: string },
	) {
		return this.users.setEmailSignature(ctx.user.id, input.signature);
	}

	@Query({
		output: usersListOutput,
		meta: restMeta("GET", "/users", ["Users"]),
	})
	async list() {
		return this.users.list();
	}
}
