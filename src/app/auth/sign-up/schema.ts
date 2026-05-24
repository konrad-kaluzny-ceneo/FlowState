import { z } from "zod";

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
