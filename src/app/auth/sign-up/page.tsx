import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthValueNarrative } from "../_components/auth-value-narrative";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
	const t = await getTranslations("Auth.signUp");

	return (
		<main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-shell-top to-shell-bottom px-4">
			<div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-card p-8 shadow-xl">
				<h1 className="mb-2 text-center font-semibold text-2xl text-primary">
					{t("title")}
				</h1>
				<AuthValueNarrative variant="sign-up" />

				<Suspense>
					<SignUpForm />
				</Suspense>
			</div>
		</main>
	);
}
