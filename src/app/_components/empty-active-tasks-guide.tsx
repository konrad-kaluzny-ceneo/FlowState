"use client";

import { EmptyGardenBed } from "~/lib/design/illustrations/empty-garden-bed";
import type { FirstRunMode } from "~/lib/onboarding/copy";

type EmptyActiveTasksGuideProps = {
	mode: FirstRunMode;
	onAddTaskClick?: () => void;
};

function getEmptyGuideMessage(mode: FirstRunMode): string {
	if (mode === "guest") {
		return "No active tasks yet — add one to start a focus cycle. Sign in to unlock energy check-ins and smart suggestions.";
	}

	return "No active tasks yet — add one to start a focus cycle.";
}

export function EmptyActiveTasksGuide({
	mode,
	onAddTaskClick,
}: EmptyActiveTasksGuideProps) {
	return (
		<div
			className="flex flex-col items-center gap-3 py-2 text-center"
			data-testid="empty-active-tasks-guide"
		>
			<EmptyGardenBed />
			<p className="text-sm text-text-dimmed">{getEmptyGuideMessage(mode)}</p>
			<button
				className="text-sm text-text-dimmed underline transition hover:text-text-section"
				data-testid="empty-active-tasks-add-btn"
				onClick={onAddTaskClick}
				type="button"
			>
				Add a task
			</button>
		</div>
	);
}
