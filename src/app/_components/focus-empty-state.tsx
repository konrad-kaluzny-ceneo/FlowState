"use client";

import { useTranslations } from "next-intl";

type FocusEmptyStateProps = {
	onAddTask: () => void;
};

export function FocusEmptyState({ onAddTask }: FocusEmptyStateProps) {
	const t = useTranslations("FocusEmpty");

	return (
		<div
			className="focus-empty-hero flex w-full flex-col items-center gap-4 rounded-card px-6 py-10 text-center shadow-sm"
			data-testid="focus-empty-state"
		>
			<h2 className="font-semibold text-text-primary text-xl">
				{t("heading")}
			</h2>
			<p className="max-w-sm text-sm text-text-secondary">{t("subtitle")}</p>
			<button
				className="mt-2 rounded-lg bg-accent-cta px-5 py-2.5 font-medium text-on-cta text-sm transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
				data-testid="focus-empty-add-task"
				onClick={onAddTask}
				type="button"
			>
				{t("cta")}
			</button>
		</div>
	);
}
