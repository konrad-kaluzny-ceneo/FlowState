import { describe, expect, it } from "vitest";

import { resolveRequestLocale } from "./resolve-request-locale";

describe("resolveRequestLocale", () => {
	it("prefers authenticated preference over a proxy-set cookie", () => {
		expect(
			resolveRequestLocale({
				cookieLocale: "en",
				authenticatedLanguage: "pl",
				isAuthenticated: true,
			}),
		).toBe("pl");
	});

	it("uses cookie for authenticated users without a stored preference", () => {
		expect(
			resolveRequestLocale({
				cookieLocale: "pl",
				authenticatedLanguage: null,
				isAuthenticated: true,
			}),
		).toBe("pl");
	});

	it("uses guest cookie from explicit switch or Accept-Language", () => {
		expect(
			resolveRequestLocale({
				cookieLocale: "pl",
				authenticatedLanguage: null,
				isAuthenticated: false,
			}),
		).toBe("pl");
	});

	it("falls back to English when no cookie or preference exists", () => {
		expect(
			resolveRequestLocale({
				cookieLocale: undefined,
				authenticatedLanguage: null,
				isAuthenticated: false,
			}),
		).toBe("en");
	});

	it("ignores invalid cookie values", () => {
		expect(
			resolveRequestLocale({
				cookieLocale: "de",
				authenticatedLanguage: "pl",
				isAuthenticated: true,
			}),
		).toBe("pl");
	});
});
