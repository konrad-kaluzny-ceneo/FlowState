"use client";

import {
	BarChart3,
	Calendar,
	CheckSquare,
	type LucideIcon,
	Settings,
	Timer,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";
import type { OnboardingScope } from "~/lib/onboarding/types";

type NavItem = {
	href: string;
	labelKey: "focus" | "tasks" | "plan" | "summary" | "settings";
	icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
	{ href: "/focus", labelKey: "focus", icon: Timer },
	{ href: "/tasks", labelKey: "tasks", icon: CheckSquare },
	{ href: "/plan", labelKey: "plan", icon: Calendar },
	{ href: "/summary", labelKey: "summary", icon: BarChart3 },
	{ href: "/settings", labelKey: "settings", icon: Settings },
];

type AppShellProps = {
	children: ReactNode;
	scope: OnboardingScope;
	userName: string | null;
};

function isActive(pathname: string, href: string): boolean {
	if (href === "/focus") {
		return pathname === "/" || pathname === "/focus";
	}
	return pathname.startsWith(href);
}

export function AppShell({ children }: AppShellProps) {
	const t = useTranslations("Navbar");
	const pathname = usePathname();

	// Auth pages render without the navigation shell
	if (pathname.startsWith("/auth")) {
		return <div className="flex min-h-screen flex-col">{children}</div>;
	}

	return (
		<div className="flex min-h-screen flex-col lg:flex-row">
			{/* Desktop sidebar */}
			<aside
				className="hidden lg:flex lg:w-56 lg:flex-shrink-0 lg:flex-col lg:border-border-subtle lg:border-r lg:bg-shell-top"
				data-testid="app-sidebar"
			>
				<div className="flex items-center gap-2 px-4 py-4">
					<Link
						className="flex items-center gap-2 font-semibold text-lg text-primary tracking-tight"
						href="/focus"
					>
						<CalmGardenSprig className="h-6 w-6" variant="idle" />
						{t("brand")}
					</Link>
				</div>

				<nav
					aria-label="Main navigation"
					className="flex flex-1 flex-col gap-1 px-2 py-2"
				>
					{NAV_ITEMS.map((item) => {
						const active = isActive(pathname, item.href);
						const Icon = item.icon;
						return (
							<Link
								className={`flex items-center gap-3 rounded-control px-3 py-2.5 font-medium text-sm transition-colors ${
									active
										? "border-accent-cta border-l-[3px] bg-accent-cta/10 pl-[calc(0.75rem-3px)] text-accent-cta"
										: "text-text-secondary hover:bg-surface-card-muted hover:text-primary"
								}`}
								data-testid={`nav-${item.labelKey}`}
								href={item.href}
								key={item.href}
							>
								<Icon className="h-4 w-4" />
								{t(item.labelKey)}
							</Link>
						);
					})}
				</nav>

				<div className="mx-3 mb-3 rounded-card border border-card-border bg-surface-card-muted/80 p-4">
					<CalmGardenSprig className="mb-3 h-8 w-8 opacity-80" variant="idle" />
					<p className="text-pretty text-text-secondary text-xs leading-relaxed">
						{t("sidebarQuote")}
					</p>
				</div>
			</aside>

			{/* Mobile top header */}
			<header
				className="flex w-full items-center justify-between border-border-subtle border-b bg-shell-top px-4 py-3 lg:hidden"
				data-testid="app-mobile-header"
			>
				<Link
					className="flex items-center gap-2 font-semibold text-lg text-primary tracking-tight"
					href="/focus"
				>
					<CalmGardenSprig className="h-6 w-6" variant="idle" />
					{t("brand")}
				</Link>
			</header>

			{/* Main content */}
			<main className="flex flex-1 flex-col pb-16 lg:pb-0">{children}</main>

			{/* Mobile bottom nav */}
			<nav
				aria-label="Main navigation"
				className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-border-subtle border-t bg-shell-top py-2 lg:hidden"
				data-testid="app-bottom-nav"
			>
				{NAV_ITEMS.map((item) => {
					const active = isActive(pathname, item.href);
					const Icon = item.icon;
					return (
						<Link
							className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors ${
								active
									? "text-primary"
									: "text-text-secondary hover:text-primary"
							}`}
							data-testid={`nav-mobile-${item.labelKey}`}
							href={item.href}
							key={item.href}
						>
							<Icon className="h-5 w-5" />
							<span>{t(item.labelKey)}</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
