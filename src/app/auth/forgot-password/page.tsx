import { Suspense } from "react";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#1a1a2e] to-[#16213e] px-4">
			<div className="w-full max-w-md rounded-lg bg-white/5 p-8 shadow-xl backdrop-blur-sm">
				<h1 className="mb-2 text-center font-bold text-2xl text-white">
					Reset your password
				</h1>
				<p className="mb-6 text-center text-sm text-white/60">
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
