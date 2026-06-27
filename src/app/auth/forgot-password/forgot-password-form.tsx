"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { forgotPasswordAction } from "./action";
import type { ForgotPasswordFormState } from "./schema";

const initialState: ForgotPasswordFormState = {
	email: "",
};

export function ForgotPasswordForm() {
	const t = useTranslations("Auth.forgotPassword");
	const tField = useTranslations("Auth.field");
	const tAuth = useTranslations("Auth");
	const [state, formAction, isPending] = useActionState(
		forgotPasswordAction,
		initialState,
	);

	if (state.success) {
		return (
			<div className="flex flex-col gap-4">
				<div
					className="rounded-md bg-green-500/10 p-3 text-green-300 text-sm"
					role="status"
				>
					{t("successMessage")}
				</div>

				<p className="text-center text-sm text-text-secondary">
					{t("googlePrompt")}{" "}
					<Link
						className="text-accent-cta underline-offset-2 hover:underline"
						href="/auth/sign-in"
					>
						{t("googleLink")}
					</Link>
				</p>

				<p className="text-center text-sm text-text-secondary">
					<Link
						className="text-accent-cta underline-offset-2 hover:underline"
						href="/auth/sign-in"
					>
						{tAuth("backToSignIn")}
					</Link>
				</p>
			</div>
		);
	}

	return (
		<>
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

				<button
					aria-disabled={isPending}
					className="mt-2 rounded-md bg-accent-cta px-4 py-2.5 font-medium text-on-cta transition hover:bg-accent-cta-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-shell-top disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isPending}
					type="submit"
				>
					{isPending ? t("submitting") : t("submit")}
				</button>
			</form>

			<p className="mt-6 text-center text-sm text-text-secondary">
				{t("rememberPrompt")}{" "}
				<Link
					className="text-accent-cta underline-offset-2 hover:underline"
					href="/auth/sign-in"
				>
					{t("signInLink")}
				</Link>
			</p>
		</>
	);
}
