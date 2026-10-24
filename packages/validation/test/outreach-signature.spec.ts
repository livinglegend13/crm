import { describe, expect, test } from "bun:test";
import {
	hasOutreachSignature,
	outreachSenderName,
	withOutreachSignature,
} from "../src/outreach-signature";

describe("outreach signatures", () => {
	test("maps each Terraeagle sender to its name", () => {
		const addresses = [
			"anika.sinha@mailx.terraeagle.com",
			"meera.rao@mailx.terraeagle.com",
			"kavya.nair@mailx.terraeagle.com",
			"neha.kapoor@mailx.terraeagle.com",
			"riya.menon@mailx.terraeagle.com",
			"aisha.khan@maily.terraeagle.com",
			"tara.mehta@maily.terraeagle.com",
			"diya.iyer@maily.terraeagle.com",
			"sara.desai@maily.terraeagle.com",
			"priya.shah@maily.terraeagle.com",
		];
		expect(addresses.map(outreachSenderName)).toEqual([
			"Anika Sinha",
			"Meera Rao",
			"Kavya Nair",
			"Neha Kapoor",
			"Riya Menon",
			"Aisha Khan",
			"Tara Mehta",
			"Diya Iyer",
			"Sara Desai",
			"Priya Shah",
		]);
	});

	test("replaces an existing sender signature without duplication", () => {
		const body = "Hello.\n\nRegards,\nAditya PS\nTerraeagle";
		const aisha = withOutreachSignature(
			body,
			"aisha.khan@maily.terraeagle.com",
		);
		expect(aisha).toBe("Hello.\n\nRegards,\nAisha Khan\nTerraeagle");
		expect(
			withOutreachSignature(aisha, "tara.mehta@maily.terraeagle.com"),
		).toBe("Hello.\n\nRegards,\nTara Mehta\nTerraeagle");
		expect(hasOutreachSignature(aisha, "aisha.khan@maily.terraeagle.com")).toBe(
			true,
		);
	});

	test("adds a signature to an unsigned agent draft", () => {
		expect(
			withOutreachSignature("Hello.", "priya.shah@maily.terraeagle.com"),
		).toBe("Hello.\n\nRegards,\nPriya Shah\nTerraeagle");
	});

	test("replaces short agent signoffs", () => {
		expect(
			withOutreachSignature(
				"Hello.\n\n— Aditya (reviewer)",
				"aisha.khan@maily.terraeagle.com",
			),
		).toBe("Hello.\n\nRegards,\nAisha Khan\nTerraeagle");
		expect(
			withOutreachSignature(
				"Hello.\n\nBest,\nAditya",
				"aisha.khan@maily.terraeagle.com",
			),
		).toBe("Hello.\n\nRegards,\nAisha Khan\nTerraeagle");
	});
});
