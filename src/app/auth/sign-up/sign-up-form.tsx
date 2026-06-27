"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AuthDivider } from "~/app/auth/_components/auth-divider";
import { GoogleSignInButton } from "~/app/auth/_components/google-sign-in-button";
import { signUpAction } from "./actions";
import type { SignUpFormState } from "./schema";

const initialState: SignUpFormState = {
	errors: {},
	values: { name: "", email: "" },
};

export function SignUpForm() {
	const t = useTranslations("Auth.signUp");
	const tField = useTranslations("Auth.field");
	const tAuth = useTranslations("Auth");
	const [state, formAction, isPending] = useActionState(
		signUpAction,
		initialState,
	);
	const searchParams = useSearchParams();
	const router = useRouter();
	const oauthError = searchParams.get("error");

	function dismissOAuthError() {
		router.replace("/auth/sign-up");
	}

	return (
		<form action={formAction} className="flex w-full flex-col gap-4" noValidate>
			{oauthError && (
				<div
					className="flex items-center justify-between rounded-md bg-red-500/10 px-4 py-3 text-red-400 text-sm"
					role="alert"
				>
					<span>{t("oauthError")}</span>
					<button
						aria-label={tAuth("dismissErrorAria")}
						className="ml-2 text-red-400 hover:text-red-300"
						onClick={dismissOAuthError}
						type="button"
					>
						✕
					</button>
				</div>
			)}

			{state.errors.form && (
				<div
					className="rounded-md bg-red-500/10 px-4 py-3 text-red-400 text-sm"
					role="alert"
				>
					{state.errors.form}
				</div>
			)}

			<div className="flex flex-col gap-1.5">
				<label className="text-sm text-text-section" htmlFor="name">
					{tField("nameLabel")}
				</label>
				<input
					aria-describedby={state.errors.name ? "name-error" : undefined}
					aria-invalid={!!state.errors.name}
					className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
					defaultValue={state.values.name}
					id="name"
					maxLength={100}
					name="name"
					placeholder={tField("namePlaceholder")}
					required
					type="text"
				/>
				{state.errors.name && (
					<p className="text-red-400 text-sm" id="name-error" role="alert">
						{state.errors.name}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-sm text-text-section" htmlFor="email">
					{tField("emailLabel")}
				</label>
				<input
					aria-describedby={state.errors.email ? "email-error" : undefined}
					aria-invalid={!!state.errors.email}
					className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
					defaultValue={state.values.email}
					id="email"
					maxLength={254}
					name="email"
					placeholder={tField("emailPlaceholder")}
					required
					type="email"
				/>
				{state.errors.email && (
					<p className="text-red-400 text-sm" id="email-error" role="alert">
						{state.errors.email}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-sm text-text-section" htmlFor="password">
					{tField("passwordLabel")}
				</label>
				<input
					aria-describedby={
						state.errors.password ? "password-error" : undefined
					}
					aria-invalid={!!state.errors.password}
					className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
					id="password"
					maxLength={128}
					minLength={8}
					name="password"
					placeholder={tField("passwordPlaceholder")}
					required
					type="password"
				/>
				{state.errors.password && (
					<p className="text-red-400 text-sm" id="password-error" role="alert">
						{state.errors.password}
					</p>
				)}
			</div>

			<button
				aria-disabled={isPending}
				className="mt-2 rounded-md bg-accent-cta px-4 py-2.5 font-medium text-on-cta transition-colors hover:bg-accent-cta-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-shell-top disabled:cursor-not-allowed disabled:opacity-50"
				disabled={isPending}
				type="submit"
			>
				{isPending ? t("submitting") : t("submit")}
			</button>

			<div className="mt-2">
				<AuthDivider />
			</div>

			<div className="mt-2">
				<GoogleSignInButton
					errorCallbackURL="/auth/sign-up?error=oauth_failed"
					mode="sign-up"
				/>
			</div>

			<p className="mt-2 text-center text-sm text-text-secondary">
				{t("haveAccount")}{" "}
				<Link
					className="text-accent-cta hover:text-accent-cta-hover"
					href="/auth/sign-in"
				>
					{t("signInLink")}
				</Link>
			</p>
		</form>
	);
}
