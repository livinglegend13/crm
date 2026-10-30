import { describe, expect, it } from "bun:test";
import { whatsappNumber } from "./whatsapp";

describe("WhatsApp phone numbers", () => {
	it("keeps an international United States number", () => {
		expect(whatsappNumber("+1-323-744-7344", "US")).toBe("13237447344");
	});

	it("adds India country code to a ten-digit local number", () => {
		expect(whatsappNumber("9900401122", "IN")).toBe("919900401122");
	});

	it("rejects an ambiguous local number", () => {
		expect(whatsappNumber("9900401122", null)).toBeNull();
	});

	it("rejects an oversized number", () => {
		expect(whatsappNumber("+12345678901234567890", null)).toBeNull();
	});
});
