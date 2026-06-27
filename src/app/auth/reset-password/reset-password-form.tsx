"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { resetPasswordAction } from "./action";
import type { ResetPasswordFormState } from "./schema";

const initialState: ResetPasswordFormState = {
	errors: {},
};

function InvalidLinkMessage({
	invalidLink,
	requestNewLink,
}: {
	invalidLink: string;
	requestNewLink: string;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div
				className="rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
				role="alert"
			>
				{invalidLink}
			</div>
			<p className="text-center text-sm text-text-secondary">
				<Link
					className="text-accent-cta underline-offset-2 hover:underline"
					href="/auth/forgot-password"
				>
					{requestNewLink}
				</Link>
			</p>
		</div>
	);
}

export function ResetPasswordForm() {
	const t = useTranslations("Auth.resetPassword");
	const tField = useTranslations("Auth.field");
	const tAuth = useTranslations("Auth");
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
		return (
			<InvalidLinkMessage
				invalidLink={t("invalidLink")}
				requestNewLink={t("requestNewLink")}
			/>
		);
	}

	if (!token) {
		return (
			<div className="flex flex-col gap-4">
				{urlError && (
					<div
						className="flex items-center justify-between rounded-md bg-red-500/10 p-3 text-red-300 text-sm"
						role="alert"
					>
						<span>{t("invalidLink")}</span>
						<button
							aria-label={tAuth("dismissErrorAria")}
							className="ml-2 text-red-300 hover:text-red-200"
							onClick={dismissUrlError}
							type="button"
						>
							✕
						</button>
					</div>
				)}
				<p className="text-center text-sm text-text-secondary">
					<Link
						className="text-accent-cta underline-offset-2 hover:underline"
						href="/auth/forgot-password"
					>
						{t("requestNewLink")}
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
					<span>{t("invalidLink")}</span>
					<button
						aria-label={tAuth("dismissErrorAria")}
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
						{state.errors.form === t("invalidLink") && (
							<p className="mt-2">
								<Link
									className="text-accent-cta underline-offset-2 hover:underline"
									href="/auth/forgot-password"
								>
									{t("requestNewLink")}
								</Link>
							</p>
						)}
					</div>
				)}

				<div className="flex flex-col gap-1.5">
					<label
						className="font-medium text-sm text-text-section"
						htmlFor="password"
					>
						{t("newPasswordLabel")}
					</label>
					<input
						aria-describedby={
							state.errors.password ? "password-error" : undefined
						}
						aria-invalid={!!state.errors.password}
						autoComplete="new-password"
						className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary transition placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
						id="password"
						maxLength={128}
						minLength={8}
						name="password"
						placeholder={tField("passwordPlaceholder")}
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
						className="font-medium text-sm text-text-section"
						htmlFor="confirmPassword"
					>
						{t("confirmLabel")}
					</label>
					<input
						aria-describedby={
							state.errors.confirmPassword
								? "confirm-password-error"
								: undefined
						}
						aria-invalid={!!state.errors.confirmPassword}
						autoComplete="new-password"
						className="rounded-md border border-border-subtle bg-surface-panel px-3 py-2 text-primary transition placeholder:text-text-dimmed focus:border-focus-ring focus:outline-none focus:ring-1 focus:ring-focus"
						id="confirmPassword"
						maxLength={128}
						minLength={8}
						name="confirmPassword"
						placeholder={t("confirmPlaceholder")}
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
					className="mt-2 rounded-md bg-accent-cta px-4 py-2.5 font-medium text-on-cta transition hover:bg-accent-cta-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-shell-top disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isPending}
					type="submit"
				>
					{isPending ? t("submitting") : t("submit")}
				</button>
			</form>

			<p className="mt-6 text-center text-sm text-text-secondary">
				<Link
					className="text-accent-cta underline-offset-2 hover:underline"
					href="/auth/sign-in"
				>
					{tAuth("backToSignIn")}
				</Link>
			</p>
		</>
	);
}
