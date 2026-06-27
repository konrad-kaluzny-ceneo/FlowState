import { describe, expect, it } from "vitest";

import { detectLocaleFromAcceptLanguage } from "./accept-language";

describe("detectLocaleFromAcceptLanguage", () => {
	it("defaults to en when header is missing", () => {
		expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
	});

	it("chooses pl when Polish is the first preferred language", () => {
		expect(detectLocaleFromAcceptLanguage("pl-PL,pl;q=0.9,en;q=0.8")).toBe(
			"pl",
		);
	});

	it("chooses pl when Polish has higher quality than English", () => {
		expect(detectLocaleFromAcceptLanguage("en;q=0.5,pl;q=0.9")).toBe("pl");
	});

	it("defaults to en for unsupported first languages", () => {
		expect(detectLocaleFromAcceptLanguage("de-DE,de;q=0.9")).toBe("en");
	});
});
