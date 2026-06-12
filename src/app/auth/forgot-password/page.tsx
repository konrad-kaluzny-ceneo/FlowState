import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-shell-top to-shell-bottom px-4">
			<div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-card p-8 shadow-xl">
				<h1 className="mb-2 text-center font-semibold text-2xl text-primary">
					Reset your password
				</h1>
				<p className="mb-6 text-center text-sm text-text-secondary">
					Enter your email and we&apos;ll send you a link to reset your
					password.
				</p>

				<Suspense>
					<ForgotPasswordForm />
				</Suspense>
			</div>
		</main>
	);
}
