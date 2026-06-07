"use server";

import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth/server";
import { type ResetPasswordFormState, resetPasswordSchema } from "./schema";

export async function resetPasswordAction(
	_prevState: ResetPasswordFormState,
	formData: FormData,
): Promise<ResetPasswordFormState> {
	const token = (formData.get("token") as string | null)?.trim() ?? "";
	const password = (formData.get("password") as string | null) ?? "";
	const confirmPassword =
		(formData.get("confirmPassword") as string | null) ?? "";

	if (!token) {
		return {
			errors: {
				form: "This reset link is invalid or has expired.",
			},
		};
	}

	const result = resetPasswordSchema.safeParse({ password, confirmPassword });

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
						form: "Could not complete the request. Please check your connection and try again.",
					},
				};
			}

			return {
				errors: {
					form: "This reset link is invalid or has expired.",
				},
			};
		}
	} catch {
		return {
			errors: {
				form: "Could not complete the request. Please check your connection and try again.",
			},
		};
	}

	redirect("/auth/sign-in?reset=success");
}
