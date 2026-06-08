import type { GuestSnapshotV1 } from "~/lib/guest/schema";

export type MergeSuccessInput = {
	importedTasks: number;
	importedCycles: number;
	previewTitles: string[];
};

export type MergeSuccessCopy = {
	title: string;
	body: string;
	dismissLabel: string;
};

const UNLOCK_LINE =
	"You now have full sessions, energy check-ins, and session-aware task suggestions.";

function compareByCreatedAt(
	a: GuestSnapshotV1["tasks"][number],
	b: GuestSnapshotV1["tasks"][number],
): number {
	return a.createdAt.getTime() - b.createdAt.getTime();
}

function isNonEmptyTitle(title: string): boolean {
	return title.trim().length > 0;
}

export function extractPreviewTaskTitles(
	snapshot: GuestSnapshotV1,
	maxTitles = 3,
): string[] {
	const active = snapshot.tasks
		.filter((task) => task.status === "active" && isNonEmptyTitle(task.title))
		.sort(compareByCreatedAt);
	const completed = snapshot.tasks
		.filter(
			(task) => task.status === "completed" && isNonEmptyTitle(task.title),
		)
		.sort(compareByCreatedAt);

	return [...active, ...completed]
		.slice(0, maxTitles)
		.map((task) => task.title);
}

function formatCountLine(
	importedTasks: number,
	importedCycles: number,
): string {
	const parts: string[] = [];

	if (importedTasks > 0) {
		parts.push(importedTasks === 1 ? "1 task" : `${importedTasks} tasks`);
	}

	if (importedCycles > 0) {
		parts.push(importedCycles === 1 ? "1 cycle" : `${importedCycles} cycles`);
	}

	if (parts.length === 0) {
		return "";
	}

	if (parts.length === 1) {
		return `Imported ${parts[0]}.`;
	}

	return `Imported ${parts[0]} and ${parts[1]}.`;
}

function formatPreviewSection(
	importedTasks: number,
	previewTitles: string[],
): string {
	if (previewTitles.length === 0) {
		return "";
	}

	const titleLines = previewTitles.map((title) => `• ${title}`);
	const overflow =
		importedTasks > previewTitles.length
			? `+ ${importedTasks - previewTitles.length} more`
			: null;

	return [...titleLines, ...(overflow ? [overflow] : [])].join("\n");
}

export function buildMergeSuccessCopy(
	input: MergeSuccessInput,
): MergeSuccessCopy {
	const { importedTasks, importedCycles, previewTitles } = input;
	const countLine = formatCountLine(importedTasks, importedCycles);
	const previewSection = formatPreviewSection(importedTasks, previewTitles);
	const bodyParts = [countLine, previewSection, UNLOCK_LINE].filter(
		(part) => part.length > 0,
	);

	return {
		title: "Your trial work is saved",
		body: bodyParts.join("\n\n"),
		dismissLabel: "Continue",
	};
}
