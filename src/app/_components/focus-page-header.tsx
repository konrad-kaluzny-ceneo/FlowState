"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useAppUser } from "~/app/_components/app-user-context";
import { UserMenu } from "~/app/_components/user-menu";

export function FocusPageHeader() {
	const t = useTranslations("FocusPage");
	const { scope, userName } = useAppUser();
	const isAuthenticated = scope.mode === "authenticated";

	const greeting =
		isAuthenticated && userName != null
			? t("greetingNamed", { name: userName.split(" ")[0] ?? userName })
			: t("greetingAnonymous");

	const subtitle =
		isAuthenticated && userName != null
			? t("subtitleNamed")
			: t("subtitleAnonymous");

	const initial =
		userName != null && userName.length > 0
			? userName.charAt(0).toUpperCase()
			: null;

	return (
		<header
			className="flex w-full items-start justify-between gap-4"
			data-testid="focus-page-header"
		>
			<div className="min-w-0">
				<h1 className="text-balance font-semibold text-2xl text-primary tracking-tight">
					{greeting}
				</h1>
				<p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
			</div>

			{isAuthenticated && userName != null && (
				<div className="flex shrink-0 items-center gap-3">
					{initial != null && (
						<Link
							aria-label={t("profileAria", { name: userName })}
							className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-cta/15 font-semibold text-accent-cta text-sm"
							data-testid="focus-page-avatar"
							href="/settings"
						>
							{initial}
						</Link>
					)}
					<div className="hidden sm:block">
						<UserMenu scope={scope} userName={userName} />
					</div>
				</div>
			)}
		</header>
	);
}
