"use server";

import { redirect } from "next/navigation";
import { auth } from "~/lib/auth/server";
import { type SignUpFormState, signUpSchema } from "./schema";

export async function signUpAction(
	_prevState: SignUpFormState,
	formData: FormData,
): Promise<SignUpFormState> {
	const name = formData.get("name") as string;
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	const result = signUpSchema.safeParse({ name, email, password });

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
						email: "This email is already associated with an existing account",
					},
					values: { name, email },
				};
			}

			return {
				errors: { form: "Could not complete the request. Please try again." },
				values: { name, email },
			};
		}
	} catch (err) {
		console.error("[sign-up] Unexpected exception:", err);
		return {
			errors: { form: "Could not complete the request. Please try again." },
			values: { name, email },
		};
	}

	redirect("/");
}
