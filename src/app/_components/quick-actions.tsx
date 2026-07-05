"use client";

import { Calendar, ChevronRight, Coffee, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { FocusWidgetCard } from "~/app/_components/focus-widget-card";

type QuickActionsProps = {
	onAddTask?: () => void;
	variant?: "inline" | "widget";
};

export function QuickActions({
	onAddTask,
	variant = "widget",
}: QuickActionsProps) {
	const t = useTranslations("QuickActions");

	const items = [
		{
			key: "addTask",
			label: t("addTask"),
			icon: Plus,
			onClick: onAddTask,
			testId: "quick-action-add-task",
		},
		{
			key: "planDay",
			label: t("planDay"),
			icon: Calendar,
			href: "/plan",
			testId: "quick-action-plan-day",
		},
		{
			key: "startBreak",
			label: t("startBreak"),
			icon: Coffee,
			href: "/focus",
			testId: "quick-action-start-break",
		},
	] as const;

	const list = (
		<ul className="space-y-1">
			{items.map((item) => {
				const Icon = item.icon;
				const rowClass =
					"flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left text-sm transition hover:bg-surface-card-muted";

				const content = (
					<>
						<Icon aria-hidden="true" className="h-4 w-4 text-accent-cta" />
						<span className="flex-1 font-medium text-primary">
							{item.label}
						</span>
						<ChevronRight
							aria-hidden="true"
							className="h-4 w-4 text-text-dimmed"
						/>
					</>
				);

				return (
					<li key={item.key}>
						{"href" in item && item.href != null ? (
							<Link
								className={rowClass}
								data-testid={item.testId}
								href={item.href}
							>
								{content}
							</Link>
						) : (
							<button
								className={rowClass}
								data-testid={item.testId}
								onClick={item.onClick}
								type="button"
							>
								{content}
							</button>
						)}
					</li>
				);
			})}
		</ul>
	);

	if (variant === "inline") {
		return (
			<div className="flex w-full flex-wrap gap-2" data-testid="quick-actions">
				<button
					className="flex flex-1 items-center justify-center rounded-lg bg-accent-cta px-3 py-2 font-medium text-on-cta text-sm transition hover:bg-accent-cta-hover"
					data-testid="quick-action-add-task"
					onClick={onAddTask}
					type="button"
				>
					{t("addTask")}
				</button>
				<Link
					className="flex flex-1 items-center justify-center rounded-lg bg-segment-inactive px-3 py-2 font-medium text-sm text-text-secondary transition hover:bg-surface-card-muted"
					data-testid="quick-action-plan-day"
					href="/plan"
				>
					{t("planDay")}
				</Link>
			</div>
		);
	}

	return (
		<FocusWidgetCard
			icon={<Zap className="h-4 w-4 text-accent-cta" />}
			testId="quick-actions"
			title={t("heading")}
		>
			{list}
		</FocusWidgetCard>
	);
}
