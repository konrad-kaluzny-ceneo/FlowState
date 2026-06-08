import { buildRationale, type RationaleKey } from "./rationale";
import { type ScoringContext, type ScoringTask, TYPE_FIT } from "./score-task";

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
		{
			key: "override_preference",
			magnitude: Math.max(0, overrideContribution),
		},
		{
			key: "interruptions",
			magnitude: Math.max(0, interruptionContribution),
		},
		{ key: "late_day", magnitude: Math.max(0, lateDayContribution) },
		{ key: "fatigue", magnitude: Math.max(0, fatigueContribution) },
		{
			key:
				context.energy === "FOCUSED" && task.workType === "DEEP_WORK"
					? "energy_deep"
					: "energy_light",
			magnitude: Math.max(0, energyContribution),
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

const KICKOFF_FALLBACK_KEYS: RationaleKey[] = [
	"override_preference",
	"fatigue",
	"interruptions",
	"late_day",
];

export function formatKickoffRationale(
	task: ScoringTask,
	context: ScoringContext,
): { rationaleKey: RationaleKey; rationale: string } {
	const dominantKey = getDominantRationaleKey(task, context);
	if (KICKOFF_FALLBACK_KEYS.includes(dominantKey)) {
		return formatTaskRationale(task, context);
	}
	const rationaleKey: RationaleKey =
		context.completedWorkCycles === 0 ? "kickoff_fresh" : "kickoff_resume";
	return {
		rationaleKey,
		rationale: buildRationale(rationaleKey, context),
	};
}
