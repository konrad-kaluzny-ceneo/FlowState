"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AuthDivider } from "~/app/auth/_components/auth-divider";
import { GoogleSignInButton } from "~/app/auth/_components/google-sign-in-button";
import { signInAction } from "./action";
import type { SignInFormState } from "./schema";

const initialState: SignInFormState = {
	error: null,
	email: "",
};

export function SignInForm() {
	const t = useTranslations("Auth.signIn");
	const tField = useTranslations("Auth.field");
	const tAuth = useTranslations("Auth");
	const [state, formAction, isPending] = useActionState(
		signInAction,
		initialState,
	);
	const searchParams = useSearchParams();
	const router = useRouter();
	const oauthError = searchParams.get("error");
	const resetSuccess = searchParams.get("reset") === "success";

	function dismissOAuthError() {
		router.replace("/auth/sign-in");
	}

	function dismissResetSuccess() {
		router.replace("/auth/sign-in");
	}

	return (
		<>
			{oauthError && (
				<div
					className="mb-4 flex items-center justify-between rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
					role="alert"
				>
					<span>{t("oauthError")}</span>
					<button
						aria-label={tAuth("dismissErrorAria")}
						className="ml-2 text-red-300 hover:text-red-200"
						onClick={dismissOAuthError}
						type="button"
					>
						✕
					</button>
				</div>
			)}

			{!oauthError && resetSuccess && (
				<div
					className="mb-4 flex items-center justify-between rounded-md bg-green-500/10 p-3 text-green-300 text-sm"
					role="status"
				>
					<span>{t("resetSuccess")}</span>
					<button
						aria-label={tAuth("dismissMessageAria")}
						className="ml-2 text-green-300 hover:text-green-200"
						onClick={dismissResetSuccess}
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
					<label
						className="font-medium text-sm text-text-section"
						htmlFor="email"
					>
						{tField("emailLabel")}
					</label>
					<input
						aria-required="true"
						autoComplete="email"
						className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary transition placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
						defaultValue={state.email}
						id="email"
						maxLength={254}
						name="email"
						placeholder={tField("emailPlaceholder")}
						required
						type="email"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						className="font-medium text-sm text-text-section"
						htmlFor="password"
					>
						{tField("passwordLabel")}
					</label>
					<input
						autoComplete="current-password"
						className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary transition placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
						id="password"
						maxLength={128}
						name="password"
						placeholder={t("passwordPlaceholder")}
						required
						type="password"
					/>
					<div className="flex justify-end">
						<Link
							className="text-accent-cta text-sm underline-offset-2 hover:underline"
							href="/auth/forgot-password"
						>
							{t("forgotPassword")}
						</Link>
					</div>
				</div>

				<button
					aria-disabled={isPending}
					className="mt-2 rounded-md bg-accent-cta px-4 py-2.5 font-medium text-on-cta transition hover:bg-accent-cta-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-shell-top disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isPending}
					type="submit"
				>
					{isPending ? t("submitting") : t("submit")}
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

			<p className="mt-6 text-center text-sm text-text-secondary">
				{t("noAccount")}{" "}
				<Link
					className="text-accent-cta underline-offset-2 hover:underline"
					href="/auth/sign-up"
				>
					{t("signUpLink")}
				</Link>
			</p>
		</>
	);
}
