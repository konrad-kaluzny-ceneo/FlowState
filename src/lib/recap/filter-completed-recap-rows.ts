import type { RecapTaskRow } from "~/lib/recap/types";

/** Rows from last24Hours that represent genuinely completed tasks. */
export function filterCompletedRecapRows(rows: RecapTaskRow[]): RecapTaskRow[] {
	return rows.filter(
		(row) => row.completedWithoutCycle === true || row.isCompleted,
	);
}
