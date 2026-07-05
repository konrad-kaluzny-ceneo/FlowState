"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";

type FocusEmptyStateProps = {
	onAddTask: () => void;
};

export function FocusEmptyState({ onAddTask }: FocusEmptyStateProps) {
	const t = useTranslations("FocusEmpty");

	return (
		<div
			className="focus-empty-hero flex w-full flex-col items-center gap-5 rounded-card border border-card-border px-6 py-12 text-center shadow-sm"
			data-testid="focus-empty-state"
		>
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay/90 shadow-sm">
				<CalmGardenSprig className="h-8 w-8" variant="idle" />
			</div>
			<div className="max-w-md">
				<h2 className="text-balance font-semibold text-primary text-xl">
					{t("heading")}
				</h2>
				<p className="mt-2 text-pretty text-sm text-text-secondary">
					{t("subtitle")}
				</p>
			</div>
			<button
				className="inline-flex items-center gap-2 rounded-control bg-accent-cta px-6 py-3 font-semibold text-on-cta text-sm transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
				data-testid="focus-empty-add-task"
				onClick={onAddTask}
				type="button"
			>
				<Plus aria-hidden="true" className="h-4 w-4" />
				{t("cta")}
			</button>
		</div>
	);
}
