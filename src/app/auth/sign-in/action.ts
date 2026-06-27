"use server";

import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "~/lib/auth/server";
import type { UserLocale } from "~/lib/domain/user-locale";
import type { SignInFormState } from "./sign-in-form";

export async function signInAction(
	_prevState: SignInFormState,
	formData: FormData,
): Promise<SignInFormState> {
	const locale = (await getLocale()) as UserLocale;
	const t = await getTranslations({ locale, namespace: "Auth.signIn" });
	const tCommon = await getTranslations({ locale, namespace: "Auth.common" });

	const email = (formData.get("email") as string | null)?.trim() ?? "";
	const password = (formData.get("password") as string | null) ?? "";

	if (!email || !password) {
		const missing: string[] = [];
		if (!email) missing.push(t("fieldEmail"));
		if (!password) missing.push(t("fieldPassword"));
		return {
			error: t("missingFields", {
				fields: missing.join(t("fieldJoiner")),
			}),
			email,
		};
	}

	try {
		const result = await auth.signIn.email({
			email,
			password,
		});

		if (result.error) {
			const code = result.error.code;

			if (
				NEON_AUTH_NETWORK_ERROR_CODES.includes(
					code as (typeof NEON_AUTH_NETWORK_ERROR_CODES)[number],
				)
			) {
				return {
					error: tCommon("networkError"),
					email,
				};
			}

			return {
				error: t("invalidCredentials"),
				email,
			};
		}
	} catch {
		return {
			error: tCommon("networkError"),
			email,
		};
	}

	redirect("/");
}
