"use client";

import { useTranslations } from "next-intl";

import { EmptyGardenBed } from "~/lib/design/illustrations/empty-garden-bed";
import type { FirstRunMode } from "~/lib/onboarding/copy";

type EmptyActiveTasksGuideProps = {
	mode: FirstRunMode;
	onAddTaskClick?: () => void;
};

export function EmptyActiveTasksGuide({
	mode,
	onAddTaskClick,
}: EmptyActiveTasksGuideProps) {
	const t = useTranslations("EmptyTasks");

	return (
		<div
			className="flex flex-col items-center gap-3 py-2 text-center"
			data-testid="empty-active-tasks-guide"
		>
			<EmptyGardenBed />
			<p className="text-sm text-text-dimmed">
				{mode === "guest" ? t("guest") : t("authenticated")}
			</p>
			<button
				className="text-sm text-text-dimmed underline transition hover:text-text-section"
				data-testid="empty-active-tasks-add-btn"
				onClick={onAddTaskClick}
				type="button"
			>
				{t("addButton")}
			</button>
		</div>
	);
}
