"use server";

import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getRequestOrigin } from "~/lib/auth/request-origin";
import { auth } from "~/lib/auth/server";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	createForgotPasswordSchema,
	type ForgotPasswordFormState,
} from "./schema";

export async function forgotPasswordAction(
	_prevState: ForgotPasswordFormState,
	formData: FormData,
): Promise<ForgotPasswordFormState> {
	const locale = (await getLocale()) as UserLocale;
	const t = await getTranslations({ locale, namespace: "Auth.forgotPassword" });
	const tCommon = await getTranslations({ locale, namespace: "Auth.common" });

	const email = (formData.get("email") as string | null)?.trim() ?? "";

	const result = createForgotPasswordSchema(locale).safeParse({ email });

	if (!result.success) {
		const fieldErrors = result.error.flatten().fieldErrors;
		return {
			error: fieldErrors.email?.[0] ?? t("emailInvalid"),
			email,
		};
	}

	const validatedEmail = result.data.email;

	try {
		const origin = await getRequestOrigin();
		const response = await auth.requestPasswordReset({
			email: validatedEmail,
			redirectTo: `${origin}/auth/reset-password`,
		});

		if (response.error) {
			const code = response.error.code;

			if (
				NEON_AUTH_NETWORK_ERROR_CODES.includes(
					code as (typeof NEON_AUTH_NETWORK_ERROR_CODES)[number],
				)
			) {
				return {
					error: tCommon("networkError"),
					email: validatedEmail,
				};
			}

			return { success: true, email: validatedEmail };
		}
	} catch {
		return { success: true, email: validatedEmail };
	}

	return { success: true, email: validatedEmail };
}
