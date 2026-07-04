"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";
import type { OnboardingScope } from "~/lib/onboarding/types";

import { GuestHeaderControls } from "./guest-header-controls";
import { UserMenu } from "./user-menu";

type AppNavbarProps = {
	scope: OnboardingScope;
	userName: string | null;
};

/**
 * Full-width app bar in document flow (never fixed/sticky): brand link home
 * on the left, preference controls and account actions on the right. Narrow
 * widths wrap the controls onto a second row instead of overflowing.
 */
export function AppNavbar({ scope, userName }: AppNavbarProps) {
	const t = useTranslations("Navbar");

	return (
		<header
			className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border-subtle border-b bg-shell-top px-4 py-3 text-primary transition-colors duration-300 motion-reduce:transition-none"
			data-testid="app-navbar"
		>
			<Link
				className="flex items-center gap-2 font-semibold text-lg text-primary tracking-tight"
				href="/"
			>
				<CalmGardenSprig className="h-6 w-6" variant="idle" />
				{t("brand")}
			</Link>
			<div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
				{userName ? (
					<UserMenu scope={scope} userName={userName} />
				) : (
					<GuestHeaderControls scope={scope} />
				)}
			</div>
		</header>
	);
}
