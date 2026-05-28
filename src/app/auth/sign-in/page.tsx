"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "./action";

export interface SignInFormState {
	error: string | null;
	email: string;
}

const initialState: SignInFormState = {
	error: null,
	email: "",
};

export default function SignInPage() {
	const [state, formAction, isPending] = useActionState(
		signInAction,
		initialState,
	);

	return (
		<main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#1a1a2e] to-[#16213e] px-4">
			<div className="w-full max-w-md rounded-lg bg-white/5 p-8 shadow-xl backdrop-blur-sm">
				<h1 className="mb-6 text-center font-bold text-2xl text-white">
					Sign in to FlowState
				</h1>

				<form action={formAction} className="flex flex-col gap-4" noValidate>
					{state.error && (
						<div
							aria-live="assertive"
							className="rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
							role="alert"
						>
							{state.error}
						</div>
					)}

					<div className="flex flex-col gap-1.5">
						<label
							className="font-medium text-sm text-white/80"
							htmlFor="email"
						>
							Email
						</label>
						<input
							aria-required="true"
							autoComplete="email"
							className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							defaultValue={state.email}
							id="email"
							maxLength={254}
							name="email"
							placeholder="you@example.com"
							required
							type="email"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label
							className="font-medium text-sm text-white/80"
							htmlFor="password"
						>
							Password
						</label>
						<input
							autoComplete="current-password"
							className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							id="password"
							maxLength={128}
							name="password"
							placeholder="••••••••"
							required
							type="password"
						/>
					</div>

					<button
						aria-disabled={isPending}
						className="mt-2 rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isPending}
						type="submit"
					>
						{isPending ? "Signing in…" : "Sign in"}
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-white/60">
					Don&apos;t have an account?{" "}
					<Link
						className="text-blue-400 underline-offset-2 hover:underline"
						href="/auth/sign-up"
					>
						Sign up
					</Link>
				</p>
			</div>
		</main>
	);
}
