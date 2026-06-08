import { Suspense } from "react";
import { AuthValueNarrative } from "../_components/auth-value-narrative";
import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#1a1a2e] to-[#16213e] px-4">
			<div className="w-full max-w-md rounded-lg bg-white/5 p-8 shadow-xl backdrop-blur-sm">
				<h1 className="mb-2 text-center font-bold text-2xl text-white">
					Create account
				</h1>
				<AuthValueNarrative variant="sign-up" />

				<Suspense>
					<SignUpForm />
				</Suspense>
			</div>
		</main>
	);
}
