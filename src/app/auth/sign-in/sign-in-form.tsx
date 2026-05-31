"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { AuthDivider } from "../_components/auth-divider";
import { GoogleSignInButton } from "../_components/google-sign-in-button";
import { signInAction } from "./action";

export interface SignInFormState {
	error: string | null;
	email: string;
}

const initialState: SignInFormState = {
	error: null,
	email: "",
};

export function SignInForm() {
	const [state, formAction, isPending] = useActionState(
		signInAction,
		initialState,
	);
	const searchParams = useSearchParams();
	const router = useRouter();
	const oauthError = searchParams.get("error");

	function dismissOAuthError() {
		router.replace("/auth/sign-in");
	}

	return (
		<>
			{oauthError && (
				<div
					className="mb-4 flex items-center justify-between rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
					role="alert"
				>
					<span>
						Could not sign in with Google. Please try again or use email and
						password.
					</span>
					<button
						aria-label="Dismiss error"
						className="ml-2 text-red-300 hover:text-red-200"
						onClick={dismissOAuthError}
						type="button"
					>
						✕
					</button>
				</div>
			)}

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
					<label className="font-medium text-sm text-white/80" htmlFor="email">
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

			<div className="mt-6">
				<AuthDivider />
			</div>

			<div className="mt-6">
				<GoogleSignInButton
					errorCallbackURL="/auth/sign-in?error=oauth_failed"
					mode="sign-in"
				/>
			</div>

			<p className="mt-6 text-center text-sm text-white/60">
				Don&apos;t have an account?{" "}
				<Link
					className="text-blue-400 underline-offset-2 hover:underline"
					href="/auth/sign-up"
				>
					Sign up
				</Link>
			</p>
		</>
	);
}
