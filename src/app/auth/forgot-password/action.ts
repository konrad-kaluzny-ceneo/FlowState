"use server";

import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { getRequestOrigin } from "~/lib/auth/request-origin";
import { auth } from "~/lib/auth/server";
import { type ForgotPasswordFormState, forgotPasswordSchema } from "./schema";

export async function forgotPasswordAction(
	_prevState: ForgotPasswordFormState,
	formData: FormData,
): Promise<ForgotPasswordFormState> {
	const email = (formData.get("email") as string | null)?.trim() ?? "";

	const result = forgotPasswordSchema.safeParse({ email });

	if (!result.success) {
		const fieldErrors = result.error.flatten().fieldErrors;
		return {
			error: fieldErrors.email?.[0] ?? "Please enter a valid email address.",
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
					error:
						"Could not complete the request. Please check your connection and try again.",
					email: validatedEmail,
				};
			}

			// Non-enumerating: do not reveal whether the email exists
			return { success: true, email: validatedEmail };
		}
	} catch {
		// Non-enumerating: treat unexpected errors as success
		return { success: true, email: validatedEmail };
	}

	return { success: true, email: validatedEmail };
}
