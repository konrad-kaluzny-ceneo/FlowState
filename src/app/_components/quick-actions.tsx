"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type QuickActionsProps = {
	onAddTask?: () => void;
};

export function QuickActions({ onAddTask }: QuickActionsProps) {
	const t = useTranslations("QuickActions");

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
