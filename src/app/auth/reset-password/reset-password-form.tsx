"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { resetPasswordAction } from "./action";
import type { ResetPasswordFormState } from "./schema";

const initialState: ResetPasswordFormState = {
	errors: {},
};

function InvalidLinkMessage() {
	return (
		<div className="flex flex-col gap-4">
			<div
				className="rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
				role="alert"
			>
				This reset link is invalid or has expired.
			</div>
			<p className="text-center text-sm text-white/60">
				<Link
					className="text-blue-400 underline-offset-2 hover:underline"
					href="/auth/forgot-password"
				>
					Request a new reset link
				</Link>
			</p>
		</div>
	);
}

export function ResetPasswordForm() {
	const [state, formAction, isPending] = useActionState(
		resetPasswordAction,
		initialState,
	);
	const searchParams = useSearchParams();
	const router = useRouter();
	const token = searchParams.get("token");
	const urlError = searchParams.get("error");

	function dismissUrlError() {
		if (token) {
			router.replace(`/auth/reset-password?token=${encodeURIComponent(token)}`);
		} else {
			router.replace("/auth/reset-password");
		}
	}

	if (!token && !urlError) {
		return <InvalidLinkMessage />;
	}

	if (!token) {
		return (
			<div className="flex flex-col gap-4">
				{urlError && (
					<div
						className="flex items-center justify-between rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
						role="alert"
					>
						<span>This reset link is invalid or has expired.</span>
						<button
							aria-label="Dismiss error"
							className="ml-2 text-red-300 hover:text-red-200"
							onClick={dismissUrlError}
							type="button"
						>
							✕
						</button>
					</div>
				)}
				<p className="text-center text-sm text-white/60">
					<Link
						className="text-blue-400 underline-offset-2 hover:underline"
						href="/auth/forgot-password"
					>
						Request a new reset link
					</Link>
				</p>
			</div>
		);
	}

	return (
		<>
			{urlError && (
				<div
					className="mb-4 flex items-center justify-between rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
					role="alert"
				>
					<span>This reset link is invalid or has expired.</span>
					<button
						aria-label="Dismiss error"
						className="ml-2 text-red-300 hover:text-red-200"
						onClick={dismissUrlError}
						type="button"
					>
						✕
					</button>
				</div>
			)}

			<form action={formAction} className="flex flex-col gap-4" noValidate>
				<input name="token" type="hidden" value={token} />

				{state.errors.form && (
					<div
						aria-live="assertive"
						className="rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
						role="alert"
					>
						<p>{state.errors.form}</p>
						{state.errors.form.includes("invalid or has expired") && (
							<p className="mt-2">
								<Link
									className="text-blue-400 underline-offset-2 hover:underline"
									href="/auth/forgot-password"
								>
									Request a new reset link
								</Link>
							</p>
						)}
					</div>
				)}

				<div className="flex flex-col gap-1.5">
					<label
						className="font-medium text-sm text-white/80"
						htmlFor="password"
					>
						New password
					</label>
					<input
						aria-describedby={
							state.errors.password ? "password-error" : undefined
						}
						aria-invalid={!!state.errors.password}
						autoComplete="new-password"
						className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						id="password"
						maxLength={128}
						minLength={8}
						name="password"
						placeholder="At least 8 characters"
						required
						type="password"
					/>
					{state.errors.password && (
						<p
							className="text-red-300 text-sm"
							id="password-error"
							role="alert"
						>
							{state.errors.password}
						</p>
					)}
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						className="font-medium text-sm text-white/80"
						htmlFor="confirmPassword"
					>
						Confirm password
					</label>
					<input
						aria-describedby={
							state.errors.confirmPassword
								? "confirm-password-error"
								: undefined
						}
						aria-invalid={!!state.errors.confirmPassword}
						autoComplete="new-password"
						className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						id="confirmPassword"
						maxLength={128}
						minLength={8}
						name="confirmPassword"
						placeholder="Confirm your password"
						required
						type="password"
					/>
					{state.errors.confirmPassword && (
						<p
							className="text-red-300 text-sm"
							id="confirm-password-error"
							role="alert"
						>
							{state.errors.confirmPassword}
						</p>
					)}
				</div>

				<button
					aria-disabled={isPending}
					className="mt-2 rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isPending}
					type="submit"
				>
					{isPending ? "Updating…" : "Set new password"}
				</button>
			</form>

			<p className="mt-6 text-center text-sm text-white/60">
				<Link
					className="text-blue-400 underline-offset-2 hover:underline"
					href="/auth/sign-in"
				>
					Back to sign in
				</Link>
			</p>
		</>
	);
}
