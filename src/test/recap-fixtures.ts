import type { RecapTaskRow } from "~/lib/recap/types";

const DEFAULT_STARTED = new Date("2026-06-20T10:00:00Z");
const DEFAULT_ENDED = new Date("2026-06-20T10:25:00Z");

/** Minimal RecapTaskRow factory for tests. */
export function recapRow(
	overrides: Partial<RecapTaskRow> & Pick<RecapTaskRow, "taskId" | "title">,
): RecapTaskRow {
	return {
		firstStartedAt: DEFAULT_STARTED,
		lastEndedAt: DEFAULT_ENDED,
		focusedMinutes: 25,
		workType: "OPERATIONAL",
		effortMinutes: null,
		isCompleted: false,
		...overrides,
	};
}
