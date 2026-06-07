import type { WorkType } from "../../../generated/prisma/client";
import { buildRationale, type RationaleKey } from "./rationale";
import type { ScoringContext, ScoringTask } from "./score-task";

const TYPE_FIT: Record<ScoringContext["energy"], Record<WorkType, number>> = {
	FOCUSED: { DEEP_WORK: 1.5, OPERATIONAL: 1.0, REACTIVE: 0.7 },
	STEADY: { DEEP_WORK: 1.1, OPERATIONAL: 1.2, REACTIVE: 1.0 },
	FADING: { DEEP_WORK: 0.6, OPERATIONAL: 1.3, REACTIVE: 1.4 },
};

export function getDominantRationaleKey(
	task: ScoringTask,
	context: ScoringContext,
): RationaleKey {
	const base = task.weight;
	const energyFit = TYPE_FIT[context.energy][task.workType];
	const energyContribution = base * (energyFit - 1);

	let fatigueContribution = 0;
	if (context.completedWorkCycles >= 4) {
		fatigueContribution =
			task.workType === "DEEP_WORK" ? base * -0.25 : base * 0.1;
	} else if (context.completedWorkCycles >= 2) {
		fatigueContribution =
			task.workType === "DEEP_WORK" ? base * -0.1 : base * 0.05;
	}

	const interruptionContribution =
		context.interruptionCount > 0
			? base * Math.max(-0.3, -context.interruptionCount * 0.1)
			: 0;

	const lateDayContribution =
		context.localHour >= 17
			? task.workType === "DEEP_WORK"
				? base * -0.15
				: base * 0.1
			: 0;

	const overrideContribution =
		context.lastOverrideWorkType != null &&
		context.lastOverrideWorkType === task.workType
			? base * 0.15
			: 0;

	const contributions: Array<{ key: RationaleKey; magnitude: number }> = [
		{ key: "override_preference", magnitude: Math.abs(overrideContribution) },
		{ key: "interruptions", magnitude: Math.abs(interruptionContribution) },
		{ key: "late_day", magnitude: Math.abs(lateDayContribution) },
		{ key: "fatigue", magnitude: Math.abs(fatigueContribution) },
		{
			key:
				context.energy === "FOCUSED" && task.workType === "DEEP_WORK"
					? "energy_deep"
					: "energy_light",
			magnitude: Math.abs(energyContribution),
		},
	];

	contributions.sort((a, b) => b.magnitude - a.magnitude);
	const top = contributions[0];
	if (top == null || top.magnitude === 0) {
		return "default";
	}
	return top.key;
}

export function formatTaskRationale(
	task: ScoringTask,
	context: ScoringContext,
): { rationaleKey: RationaleKey; rationale: string } {
	const rationaleKey = getDominantRationaleKey(task, context);
	return {
		rationaleKey,
		rationale: buildRationale(rationaleKey, context),
	};
}
