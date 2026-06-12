"use client";

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
		<div className="space-y-2" data-testid="empty-active-tasks-guide">
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
