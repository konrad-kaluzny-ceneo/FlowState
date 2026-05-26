"use server";

import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth/server";
import type { SignInFormState } from "./page";

export async function signInAction(
	_prevState: SignInFormState,
	formData: FormData,
): Promise<SignInFormState> {
	const email = (formData.get("email") as string | null)?.trim() ?? "";
	const password = (formData.get("password") as string | null) ?? "";

	// Client-side validation: reject empty fields
	if (!email || !password) {
		const missing: string[] = [];
		if (!email) missing.push("email");
		if (!password) missing.push("password");
		return {
			error: `Please enter your ${missing.join(" and ")}.`,
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

			// Check if it's a network error
			if (
				NEON_AUTH_NETWORK_ERROR_CODES.includes(
					code as (typeof NEON_AUTH_NETWORK_ERROR_CODES)[number],
				)
			) {
				return {
					error:
						"Could not complete the request. Please check your connection and try again.",
					email,
				};
			}

			// Generic error for invalid credentials — don't reveal which field is wrong
			return {
				error: "Invalid email or password. Please try again.",
				email,
			};
		}
	} catch {
		// Network or unexpected error
		return {
			error:
				"Could not complete the request. Please check your connection and try again.",
			email,
		};
	}

	redirect("/");
}
