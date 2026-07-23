/**
 * Day-plan stamping rule extracted from `use-pomodoro-cycle` (F-09).
 *
 * Pure apart from the ambient date, which `formatLocalDateKey` accepts.
 */

import type { DataMode, DomainTaskId } from "~/lib/data-mode/types";
import type { CycleKind } from "~/lib/domain/cycle-kind";
import { formatLocalDateKey } from "~/lib/time/local-date-key";

export type CompleteCycleArgs = {
	cycleId: DomainTaskId;
	markTaskDone?: boolean;
	markTaskBlocked?: boolean;
	incrementInterruption?: boolean;
};

/**
 * Only authenticated WORK completions carry a `localDateKey` — guest mode has
 * no server day plan, and breaks never advance it.
 */
export function withWorkDayPlanKey(
	input: CompleteCycleArgs,
	options: {
		kind: CycleKind | null;
		mode: DataMode;
		now?: Date;
	},
): CompleteCycleArgs & { localDateKey?: string } {
	if (options.mode !== "authenticated" || options.kind !== "WORK") {
		return input;
	}
	return { ...input, localDateKey: formatLocalDateKey(options.now) };
}
