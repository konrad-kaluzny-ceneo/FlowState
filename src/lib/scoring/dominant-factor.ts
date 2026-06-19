import { buildRationale, type RationaleKey } from "./rationale";
import {
	computeEisenhowerBase,
	type ScoringContext,
	type ScoringTask,
	TYPE_FIT,
} from "./score-task";

export function getFactorContributions(
	task: ScoringTask,
	context: ScoringContext,
): Array<{ key: RationaleKey; magnitude: number }> {
	const eisenhowerProduct = task.urgency * task.importance;
	const base = computeEisenhowerBase(task, context);

	const eisenhowerPriorityContribution =
		eisenhowerProduct >= 6 ? eisenhowerProduct * 0.25 : 0;

	const importanceFocusContribution =
		context.energy === "FOCUSED" && task.importance >= 3
			? eisenhowerProduct * 0.15
			: 0;

	const lowEffortContribution =
		context.energy === "FADING" &&
		task.effortMinutes != null &&
		task.effortMinutes <= 30
			? eisenhowerProduct * 0.12
			: 0;

	const horizonAsapContribution =
		task.commitmentHorizon === "ASAP" ? eisenhowerProduct * 0.18 : 0;

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
			? task.workType === "REACTIVE"
				? base * Math.min(context.interruptionCount, 4) * 0.04
				: base * Math.max(-0.3, -context.interruptionCount * 0.1)
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

	const remaining = context.remainingFocusMinutes;
	const capacityFitContribution =
		remaining != null &&
		task.effortMinutes != null &&
		task.effortMinutes <= remaining
			? base * 0.15
			: 0;

	const contributions: Array<{ key: RationaleKey; magnitude: number }> = [
		{
			key: "eisenhower_priority",
			magnitude: Math.max(0, eisenhowerPriorityContribution),
		},
		{
			key: "importance_focus",
			magnitude: Math.max(0, importanceFocusContribution),
		},
		{
			key: "low_effort_fit",
			magnitude: Math.max(0, lowEffortContribution),
		},
		{
			key: "horizon_asap",
			magnitude: Math.max(0, horizonAsapContribution),
		},
		{
			key: "override_preference",
			magnitude: Math.max(0, overrideContribution),
		},
		{
			key: "capacity_fit",
			magnitude: Math.max(0, capacityFitContribution),
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
	return contributions;
}

export function getDominantRationaleKey(
	task: ScoringTask,
	context: ScoringContext,
): RationaleKey {
	const contributions = getFactorContributions(task, context);
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
	"capacity_fit",
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
