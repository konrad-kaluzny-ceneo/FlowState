import { createTranslator } from "next-intl";
import { vi } from "vitest";

import enMessages from "../../messages/en.json";

function createTestTranslator(namespace?: string) {
	return createTranslator({
		locale: "en",
		messages: enMessages,
		namespace: namespace as never,
	}) as (key: string, values?: Record<string, unknown>) => string;
}

function resolveNamespace(
	arg?: string | { locale?: string; namespace?: string },
): string | undefined {
	if (typeof arg === "string") {
		return arg;
	}
	return arg?.namespace;
}

vi.mock("next-intl", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next-intl")>();
	return {
		...actual,
		useLocale: () => "en",
		useTranslations: (namespace?: string) => createTestTranslator(namespace),
	};
});

vi.mock("next-intl/server", () => ({
	getLocale: async () => "en",
	getTranslations: async (
		arg?: string | { locale?: string; namespace?: string },
	) => createTestTranslator(resolveNamespace(arg)),
	getMessages: async () => enMessages,
}));
