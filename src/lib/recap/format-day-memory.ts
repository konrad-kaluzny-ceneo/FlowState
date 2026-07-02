import type { DomainTaskId } from "~/lib/data-mode/types";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	buildDayMemoryCollapsedLine,
	getDayMemoryDoneCount,
	getDayMemoryRemainingCount,
	getDayMemorySectionDone,
	getDayMemorySectionRemains,
	getDayMemorySectionReturnTo,
} from "~/lib/session/narrative-copy";
import { pickHandoffTaskContext } from "~/lib/session/return-handoff";

import type { DailyRecap, RecapTaskId } from "./types";

export type DayMemoryDoneItem = { taskId: RecapTaskId; title: string };
export type DayMemoryRemainingItem = { taskId: RecapTaskId; title: string };
export type DayMemoryReturnTo = {
	taskTitle: string;
	resumeNote: string | null;
} | null;

export type DayMemory = {
	collapsedLine: string;
	sections: {
		done: { label: string; items: DayMemoryDoneItem[] };
		remains: { label: string; items: DayMemoryRemainingItem[] };
		returnTo: { label: string; value: DayMemoryReturnTo };
	};
	hasContent: boolean;
};

export type FormatDayMemoryInput = {
	recap: DailyRecap;
	tasks: Array<{
		id: DomainTaskId;
		status: string;
		title: string;
		resumeNote?: string | null;
	}>;
	continueTaskId: DomainTaskId | null;
	locale: UserLocale;
};

function resolveReturnTo(input: FormatDayMemoryInput): DayMemoryReturnTo {
	if (input.continueTaskId == null) {
		return null;
	}

	const { taskTitle, resumeNote } = pickHandoffTaskContext(input.tasks);
	if (taskTitle == null) {
		return null;
	}

	return { taskTitle, resumeNote };
}

export function formatDayMemory(input: FormatDayMemoryInput): DayMemory {
	const { recap, locale } = input;

	const doneItems: DayMemoryDoneItem[] = recap.last24Hours.map((row) => ({
		taskId: row.taskId,
		title: row.title,
	}));

	const remainingItems: DayMemoryRemainingItem[] = recap.todayPlan
		.filter((row) => !row.doneForToday)
		.map((row) => ({ taskId: row.taskId, title: row.title }));

	const returnTo = resolveReturnTo(input);

	const doneLabel = getDayMemorySectionDone(locale);
	const remainsLabel = getDayMemorySectionRemains(locale);
	const returnToLabel = getDayMemorySectionReturnTo(locale);

	const collapsedLine = buildDayMemoryCollapsedLine(
		{
			done: getDayMemoryDoneCount(doneItems.length, locale),
			remaining: getDayMemoryRemainingCount(remainingItems.length, locale),
			next: returnTo?.taskTitle ?? returnToLabel,
		},
		locale,
	);

	const hasContent =
		doneItems.length > 0 || remainingItems.length > 0 || returnTo != null;

	return {
		collapsedLine,
		sections: {
			done: { label: doneLabel, items: doneItems },
			remains: { label: remainsLabel, items: remainingItems },
			returnTo: { label: returnToLabel, value: returnTo },
		},
		hasContent,
	};
}
