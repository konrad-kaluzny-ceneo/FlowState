"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type GuestBannerProps = {
	variant?: "header" | "rail-activation";
};

const BANNER_CLASS =
	"w-full max-w-lg rounded-card border border-accent-warn-border bg-accent-warn-bg px-4 py-3 text-primary text-sm";

export function GuestBanner({ variant = "header" }: GuestBannerProps) {
	const t = useTranslations("Guest.banner");

	const className =
		variant === "header"
			? `${BANNER_CLASS} lg:hidden`
			: `${BANNER_CLASS} lg:max-w-none`;

	const testId =
		variant === "header" ? "guest-banner" : "guest-rail-activation-hint";

	return (
		<div className={className} data-testid={testId}>
			<p>
				{t("deviceOnly")}{" "}
				<Link
					className="font-medium text-accent-warn underline hover:text-accent-cta"
					href="/auth/sign-in"
				>
					{t("signIn")}
				</Link>{" "}
				{t("or")}{" "}
				<Link
					className="font-medium text-accent-warn underline hover:text-accent-cta"
					href="/auth/sign-up"
				>
					{t("signUp")}
				</Link>{" "}
				{t("saveAcrossDevices")}
			</p>
		</div>
	);
}
