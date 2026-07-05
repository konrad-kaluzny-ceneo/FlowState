import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthValueNarrative } from "../_components/auth-value-narrative";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
	const t = await getTranslations("Auth.signUp");

	return (
		<main className="auth-hero-bg flex flex-1 items-center justify-center px-4">
			<div className="relative z-10 w-full max-w-md rounded-lg border border-border-subtle bg-surface-card p-8 shadow-xl">
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
