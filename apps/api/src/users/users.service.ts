import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export interface UserOption {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

@Injectable()
export class UsersService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async emailSignature(userId: string): Promise<string> {
		const user = await this.db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { emailSignature: true },
		});
		return user.emailSignature ?? "";
	}

	async setEmailSignature(userId: string, signature: string): Promise<string> {
		const saved = await this.db.user.update({
			where: { id: userId },
			data: { emailSignature: signature.trim() || null },
			select: { emailSignature: true },
		});
		return saved.emailSignature ?? "";
	}

	async list(): Promise<UserOption[]> {
		return this.db.user.findMany({
			select: { id: true, name: true, email: true, image: true },
			orderBy: [{ name: "asc" }, { email: "asc" }],
		});
	}
}
