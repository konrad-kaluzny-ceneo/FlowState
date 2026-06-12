import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-shell-top to-shell-bottom px-4">
			<div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-card p-8 shadow-xl">
				<h1 className="mb-2 text-center font-semibold text-2xl text-primary">
					Set a new password
				</h1>
				<p className="mb-6 text-center text-sm text-text-secondary">
					Choose a new password for your account.
				</p>

				<Suspense>
					<ResetPasswordForm />
				</Suspense>
			</div>
		</main>
	);
}
