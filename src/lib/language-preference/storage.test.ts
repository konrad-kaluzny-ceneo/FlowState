import { beforeEach, describe, expect, it } from "vitest";

import {
	readGuestLanguageForMerge,
	readGuestLanguagePreference,
	readLanguagePreference,
	writeLanguagePreference,
} from "./storage";

describe("language-preference storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("scopes guest and authenticated keys separately", () => {
		writeLanguagePreference({ mode: "guest" }, "pl");
		writeLanguagePreference({ mode: "authenticated", userId: "user-a" }, "en");
		writeLanguagePreference({ mode: "authenticated", userId: "user-b" }, "pl");

		expect(readLanguagePreference({ mode: "guest" })).toBe("pl");
		expect(
			readLanguagePreference({ mode: "authenticated", userId: "user-a" }),
		).toBe("en");
		expect(
			readLanguagePreference({ mode: "authenticated", userId: "user-b" }),
		).toBe("pl");
	});

	it("returns null for guest merge when preference is default or missing", () => {
		expect(readGuestLanguageForMerge()).toBeNull();
		writeLanguagePreference({ mode: "guest" }, "pl");
		expect(readGuestLanguageForMerge()).toBeNull();
	});

	it("returns guest preference for merge when non-default locale is stored", () => {
		writeLanguagePreference({ mode: "guest" }, "en");
		expect(readGuestLanguageForMerge()).toBe("en");
		expect(readGuestLanguagePreference()).toBe("en");
	});
});
