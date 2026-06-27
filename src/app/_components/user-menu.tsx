"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "~/lib/auth/client";
import type { OnboardingScope } from "~/lib/onboarding/types";

import { HeaderPreferenceControls } from "./header-preference-controls";

export function UserMenu({
	userName,
	scope,
}: {
	userName: string;
	scope: OnboardingScope;
}) {
	const t = useTranslations("UserMenu");
	const [error, setError] = useState<string | null>(null);
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function handleSignOut() {
		setError(null);
		setIsSigningOut(true);

		try {
			await authClient.signOut();
			window.location.href = "/auth/sign-in";
		} catch {
			setError(t("signOutError"));
			setIsSigningOut(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			<HeaderPreferenceControls scope={scope} />
			<span className="text-primary text-sm">{userName}</span>
			<button
				className="rounded-md border border-border-subtle bg-surface-card px-3 py-1.5 font-medium text-primary text-sm transition-colors hover:bg-surface-card-muted disabled:opacity-50"
				disabled={isSigningOut}
				onClick={handleSignOut}
				type="button"
			>
				{isSigningOut ? t("signingOut") : t("signOut")}
			</button>
			{error && (
				<span className="text-red-400 text-sm" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
