"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "~/lib/auth/server";

export const signUpSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less")
		.refine((val) => val.trim().length > 0, "Name cannot be only whitespace"),
	email: z
		.string()
		.min(1, "Email is required")
		.max(254, "Email must be 254 characters or less")
		.email("Please enter a valid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(128, "Password must be 128 characters or less"),
});

export interface SignUpFormState {
	errors: {
		name?: string;
		email?: string;
		password?: string;
		form?: string;
	};
	values: {
		name: string;
		email: string;
	};
}

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
	} catch {
		return {
			errors: { form: "Could not complete the request. Please try again." },
			values: { name, email },
		};
	}

	redirect("/");
}
