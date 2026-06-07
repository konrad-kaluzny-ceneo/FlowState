import { z } from "zod";

export const forgotPasswordSchema = z.object({
	email: z
		.string()
		.min(1, "Email is required")
		.max(254, "Email must be 254 characters or less")
		.email("Please enter a valid email address"),
});

export interface ForgotPasswordFormState {
	error?: string;
	email: string;
	success?: boolean;
}
