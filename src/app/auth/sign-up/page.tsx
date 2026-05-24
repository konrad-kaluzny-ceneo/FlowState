import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#1a1a2e] to-[#16213e] px-4 py-8">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<h1 className="font-bold text-3xl text-white tracking-tight">
						Create account
					</h1>
					<p className="mt-2 text-sm text-white/60">
						Sign up to start using FlowState
					</p>
				</div>
				<SignUpForm />
			</div>
		</main>
	);
}
