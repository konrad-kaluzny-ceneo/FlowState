"use client";

import { Calendar, CheckSquare, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type GettingStartedItem = {
	key: "addTask" | "planDay";
	icon: LucideIcon;
	href?: string;
	onClick?: () => void;
};

type FocusGettingStartedProps = {
	onAddTask: () => void;
};

export function FocusGettingStarted({ onAddTask }: FocusGettingStartedProps) {
	const t = useTranslations("FocusGettingStarted");

	const items: GettingStartedItem[] = [
		{ key: "addTask", icon: CheckSquare, onClick: onAddTask },
		{ key: "planDay", icon: Calendar, href: "/plan" },
	];

	return (
		<section className="w-full" data-testid="focus-getting-started">
			<div className="mb-4">
				<h2 className="font-semibold text-lg text-primary">{t("heading")}</h2>
				<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				{items.map((item) => {
					const Icon = item.icon;
					const content = (
						<>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-cta/10 text-accent-cta">
								<Icon className="h-5 w-5" />
							</div>
							<div className="min-w-0">
								<p className="font-medium text-primary text-sm">
									{t(`${item.key}Title`)}
								</p>
								<p className="mt-0.5 text-pretty text-text-secondary text-xs">
									{t(`${item.key}Body`)}
								</p>
							</div>
						</>
					);

					const className =
						"flex items-start gap-3 rounded-card border border-card-border bg-surface-card p-4 text-left shadow-sm transition hover:border-accent-cta/25 hover:shadow-md";

					if (item.href != null) {
						return (
							<Link
								className={className}
								data-testid={`getting-started-${item.key}`}
								href={item.href}
								key={item.key}
							>
								{content}
							</Link>
						);
					}

					return (
						<button
							className={className}
							data-testid={`getting-started-${item.key}`}
							key={item.key}
							onClick={item.onClick}
							type="button"
						>
							{content}
						</button>
					);
				})}
			</div>
		</section>
	);
}
