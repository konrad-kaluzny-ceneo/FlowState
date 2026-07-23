// Sign-in validation is imperative in action.ts (no zod schema), so this
// module holds only the shared form-state type — unlike sign-up/reset-password
// schema.ts, which also export a zod schema.
export interface SignInFormState {
	error: string | null;
	email: string;
}
