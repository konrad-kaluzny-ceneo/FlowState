"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function GuestBanner() {
	const t = useTranslations("Guest.banner");

	return (
		<div
			className="w-full max-w-lg rounded-lg border border-amber-400/30 bg-surface-card px-4 py-3 text-amber-900 text-sm"
			data-testid="guest-banner"
		>
			<p>
				{t("deviceOnly")}{" "}
				<Link
					className="font-medium text-amber-700 underline hover:text-accent-cta"
					href="/auth/sign-in"
				>
					{t("signIn")}
				</Link>{" "}
				{t("or")}{" "}
				<Link
					className="font-medium text-amber-700 underline hover:text-accent-cta"
					href="/auth/sign-up"
				>
					{t("signUp")}
				</Link>{" "}
				{t("saveAcrossDevices")}
			</p>
		</div>
	);
}
