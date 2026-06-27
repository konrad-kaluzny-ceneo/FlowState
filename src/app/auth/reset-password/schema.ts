import { z } from "zod";

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

import { createPasswordSchema } from "../sign-up/schema";

export function createResetPasswordSchema(locale: UserLocale = "en") {
	const t = createNamespaceTranslator("Auth.resetPassword", locale);

	return z
		.object({
			password: createPasswordSchema(locale),
			confirmPassword: z.string(),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: t("validationMismatch"),
			path: ["confirmPassword"],
		});
}

export const resetPasswordSchema = createResetPasswordSchema();

export interface ResetPasswordFormState {
	errors: {
		password?: string;
		confirmPassword?: string;
		form?: string;
	};
}
