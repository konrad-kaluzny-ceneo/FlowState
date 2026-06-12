import { Suspense } from "react";
import { AuthValueNarrative } from "../_components/auth-value-narrative";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-shell-top to-shell-bottom px-4">
			<div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-card p-8 shadow-xl">
				<h1 className="mb-2 text-center font-semibold text-2xl text-primary">
					Sign in to FlowState
				</h1>
				<AuthValueNarrative variant="sign-in" />

				<Suspense>
					<SignInForm />
				</Suspense>
			</div>
		</main>
	);
}
