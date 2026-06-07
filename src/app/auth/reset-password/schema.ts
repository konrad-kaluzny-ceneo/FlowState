import { z } from "zod";
import { passwordSchema } from "../sign-up/schema";

export const resetPasswordSchema = z
	.object({
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export interface ResetPasswordFormState {
	errors: {
		password?: string;
		confirmPassword?: string;
		form?: string;
	};
}
