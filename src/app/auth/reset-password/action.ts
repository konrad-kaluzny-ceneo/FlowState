"use server";

import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "~/lib/auth/server";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	createResetPasswordSchema,
	type ResetPasswordFormState,
} from "./schema";

export async function resetPasswordAction(
	_prevState: ResetPasswordFormState,
	formData: FormData,
): Promise<ResetPasswordFormState> {
	const locale = (await getLocale()) as UserLocale;
	const t = await getTranslations({ locale, namespace: "Auth.resetPassword" });
	const tCommon = await getTranslations({ locale, namespace: "Auth.common" });

	const token = (formData.get("token") as string | null)?.trim() ?? "";
	const password = (formData.get("password") as string | null) ?? "";
	const confirmPassword =
		(formData.get("confirmPassword") as string | null) ?? "";

	if (!token) {
		return {
			errors: {
				form: t("invalidLink"),
			},
		};
	}

	const result = createResetPasswordSchema(locale).safeParse({
		password,
		confirmPassword,
	});

	if (!result.success) {
		const fieldErrors = result.error.flatten().fieldErrors;
		return {
			errors: {
				password: fieldErrors.password?.[0],
				confirmPassword: fieldErrors.confirmPassword?.[0],
			},
		};
	}

	try {
		const response = await auth.resetPassword({
			newPassword: result.data.password,
			token,
		});

		if (response.error) {
			const code = response.error.code;

			if (
				NEON_AUTH_NETWORK_ERROR_CODES.includes(
					code as (typeof NEON_AUTH_NETWORK_ERROR_CODES)[number],
				)
			) {
				return {
					errors: {
						form: tCommon("networkError"),
					},
				};
			}

			return {
				errors: {
					form: t("invalidLink"),
				},
			};
		}
	} catch {
		return {
			errors: {
				form: tCommon("networkError"),
			},
		};
	}

	redirect("/auth/sign-in?reset=success");
}
