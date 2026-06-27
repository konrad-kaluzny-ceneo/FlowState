import { z } from "zod";

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export function createSignUpSchema(locale: UserLocale = "en") {
	const validation = createNamespaceTranslator("Auth.validation", locale);
	const signUpValidation = createNamespaceTranslator(
		"Auth.signUp.validation",
		locale,
	);

	return z.object({
		name: z
			.string()
			.min(1, signUpValidation("nameRequired"))
			.max(100, signUpValidation("nameMax"))
			.refine(
				(val) => val.trim().length > 0,
				signUpValidation("nameWhitespace"),
			),
		email: z
			.string()
			.min(1, validation("emailRequired"))
			.max(254, validation("emailMax"))
			.email(validation("emailInvalid")),
		password: z
			.string()
			.min(8, validation("passwordMin"))
			.max(128, validation("passwordMax")),
	});
}

export function createPasswordSchema(locale: UserLocale = "en") {
	return createSignUpSchema(locale).shape.password;
}

export const signUpSchema = createSignUpSchema();
export const passwordSchema = createPasswordSchema();

export interface SignUpFormState {
	errors: {
		name?: string;
		email?: string;
		password?: string;
		form?: string;
	};
	values: {
		name: string;
		email: string;
	};
}
