import { z } from "zod";

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export function createForgotPasswordSchema(locale: UserLocale = "en") {
	const validation = createNamespaceTranslator("Auth.validation", locale);

	return z.object({
		email: z
			.string()
			.min(1, validation("emailRequired"))
			.max(254, validation("emailMax"))
			.email(validation("emailInvalid")),
	});
}

export const forgotPasswordSchema = createForgotPasswordSchema();

export interface ForgotPasswordFormState {
	error?: string;
	email: string;
	success?: boolean;
}
