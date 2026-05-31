import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#1a1a2e] to-[#16213e] px-4">
			<div className="w-full max-w-md rounded-lg bg-white/5 p-8 shadow-xl backdrop-blur-sm">
				<h1 className="mb-6 text-center font-bold text-2xl text-white">
					Sign in to FlowState
				</h1>

				<Suspense>
					<SignInForm />
				</Suspense>
			</div>
		</main>
	);
}
