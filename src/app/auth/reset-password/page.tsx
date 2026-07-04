import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
	const t = await getTranslations("Auth.resetPassword");

	return (
		<main className="flex flex-1 items-center justify-center bg-gradient-to-b from-shell-top to-shell-bottom px-4">
			<div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-card p-8 shadow-xl">
				<h1 className="mb-2 text-center font-semibold text-2xl text-primary">
					{t("title")}
				</h1>
				<p className="mb-6 text-center text-sm text-text-secondary">
					{t("subtitle")}
				</p>

				<Suspense>
					<ResetPasswordForm />
				</Suspense>
			</div>
		</main>
	);
}
