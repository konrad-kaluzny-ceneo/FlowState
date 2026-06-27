import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";
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

function mergeT(locale: UserLocale) {
	return createNamespaceTranslator("Guest.merge", locale);
}

function compareBySortOrder(
	a: GuestSnapshotV1["tasks"][number],
	b: GuestSnapshotV1["tasks"][number],
): number {
	return a.sortOrder - b.sortOrder;
}

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
		.sort(compareBySortOrder);
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
	locale: UserLocale,
): string {
	const t = mergeT(locale);
	const parts: string[] = [];

	if (importedTasks > 0) {
		parts.push(t("taskCount", { count: importedTasks }));
	}

	if (importedCycles > 0) {
		parts.push(t("cycleCount", { count: importedCycles }));
	}

	if (parts.length === 0) {
		return "";
	}

	if (parts.length === 1) {
		return t("importedSingle", { item: parts[0] ?? "" });
	}

	return t("importedDual", {
		first: parts[0] ?? "",
		second: parts[1] ?? "",
	});
}

function formatPreviewSection(
	importedTasks: number,
	previewTitles: string[],
	locale: UserLocale,
): string {
	if (previewTitles.length === 0) {
		return "";
	}

	const t = mergeT(locale);
	const titleLines = previewTitles.map((title) => `• ${title}`);
	const overflow =
		importedTasks > previewTitles.length
			? t("overflow", { count: importedTasks - previewTitles.length })
			: null;

	return [...titleLines, ...(overflow ? [overflow] : [])].join("\n");
}

export function buildMergeSuccessCopy(
	input: MergeSuccessInput,
	locale: UserLocale = "en",
): MergeSuccessCopy {
	const t = mergeT(locale);
	const { importedTasks, importedCycles, previewTitles } = input;
	const countLine = formatCountLine(importedTasks, importedCycles, locale);
	const previewSection = formatPreviewSection(
		importedTasks,
		previewTitles,
		locale,
	);
	const bodyParts = [countLine, previewSection, t("unlockLine")].filter(
		(part) => part.length > 0,
	);

	return {
		title: t("title"),
		body: bodyParts.join("\n\n"),
		dismissLabel: t("dismissLabel"),
	};
}
