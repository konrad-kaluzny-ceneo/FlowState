"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "~/lib/auth/server";
import type { UserLocale } from "~/lib/domain/user-locale";
import { createSignUpSchema, type SignUpFormState } from "./schema";

export async function signUpAction(
	_prevState: SignUpFormState,
	formData: FormData,
): Promise<SignUpFormState> {
	const locale = (await getLocale()) as UserLocale;
	const t = await getTranslations({ locale, namespace: "Auth.signUp" });

	const name = formData.get("name") as string;
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	const result = createSignUpSchema(locale).safeParse({
		name,
		email,
		password,
	});

	if (!result.success) {
		const fieldErrors = result.error.flatten().fieldErrors;
		return {
			errors: {
				name: fieldErrors.name?.[0],
				email: fieldErrors.email?.[0],
				password: fieldErrors.password?.[0],
			},
			values: { name, email },
		};
	}

	try {
		const response = await auth.signUp.email({
			name: result.data.name.trim(),
			email: result.data.email,
			password: result.data.password,
		});

		if (response.error) {
			const errorMessage = response.error.message ?? "";
			console.error(
				"[sign-up] Auth error response:",
				JSON.stringify(response.error),
			);

			if (
				errorMessage.toLowerCase().includes("already") ||
				errorMessage.toLowerCase().includes("exists") ||
				errorMessage.toLowerCase().includes("registered")
			) {
				return {
					errors: {
						email: t("error.emailExists"),
					},
					values: { name, email },
				};
			}

			return {
				errors: { form: t("error.generic") },
				values: { name, email },
			};
		}
	} catch (err) {
		console.error("[sign-up] Unexpected exception:", err);
		return {
			errors: { form: t("error.generic") },
			values: { name, email },
		};
	}

	redirect("/");
}
