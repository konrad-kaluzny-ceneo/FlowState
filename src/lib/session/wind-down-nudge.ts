import type { EnergyLevel } from "~/lib/domain/energy-level";

import { buildRationale } from "~/lib/scoring/rationale";
import type { ScoringContext } from "~/lib/scoring/score-task";

export type WindDownInput = {
	energy: EnergyLevel;
	completedWorkCycles: number;
	interruptionCount: number;
	dismissed: boolean;
};

export function shouldShowWindDownNudge(input: WindDownInput): boolean {
	return (
		input.energy === "FADING" &&
		!input.dismissed &&
		(input.completedWorkCycles >= 3 || input.interruptionCount >= 2)
	);
}

export function buildWindDownRationale(input: WindDownInput): string {
	const context: ScoringContext = {
		energy: "FADING",
		completedWorkCycles:
			input.completedWorkCycles >= 3
				? input.completedWorkCycles + 1
				: input.completedWorkCycles,
		interruptionCount: input.interruptionCount,
		localHour: 12,
	};

	if (input.completedWorkCycles >= 3) {
		return buildRationale("fatigue", context);
	}

	return buildRationale("interruptions", context);
}
