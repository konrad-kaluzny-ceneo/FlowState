import type { CommitmentHorizon, EnergyLevel, WorkType } from "~/lib/domain";

export type ScoringContext = {
	energy: EnergyLevel;
	completedWorkCycles: number;
	interruptionCount: number;
	localHour: number;
	lastOverrideWorkType?: WorkType;
	remainingFocusMinutes?: number | null;
};

export type ScoringTask = {
	id: number;
	workType: WorkType;
	weight: number;
	importance: number;
	urgency: number;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	sortOrder: number;
	createdAt: Date;
};

export const TYPE_FIT: Record<EnergyLevel, Record<WorkType, number>> = {
	FOCUSED: { DEEP_WORK: 1.5, OPERATIONAL: 1.0, REACTIVE: 0.7 },
	STEADY: { DEEP_WORK: 1.1, OPERATIONAL: 1.2, REACTIVE: 1.0 },
	FADING: { DEEP_WORK: 0.6, OPERATIONAL: 1.3, REACTIVE: 1.4 },
};

export function computeEisenhowerBase(
	task: ScoringTask,
	context: ScoringContext,
): number {
	let base = task.urgency * task.importance;

	if (context.energy === "FOCUSED" && task.importance >= 3) {
		base *= 1.15;
	}

	if (context.energy === "FADING" && task.effortMinutes != null) {
		if (task.effortMinutes <= 30) {
			base *= 1.12;
		}
		if (task.effortMinutes >= 90) {
			base *= 0.88;
		}
	}

	if (task.commitmentHorizon === "ASAP") {
		base *= 1.18;
	}
	if (task.commitmentHorizon === "THIS_WEEK") {
		base *= 1.06;
	}

	return base;
}

export function scoreTask(task: ScoringTask, context: ScoringContext): number {
	let score = computeEisenhowerBase(task, context);

	score *= TYPE_FIT[context.energy][task.workType];

	if (context.completedWorkCycles >= 4) {
		score *= task.workType === "DEEP_WORK" ? 0.75 : 1.1;
	} else if (context.completedWorkCycles >= 2) {
		score *= task.workType === "DEEP_WORK" ? 0.9 : 1.05;
	}

	if (context.interruptionCount > 0) {
		const capped = Math.min(context.interruptionCount, 4);
		if (task.workType === "DEEP_WORK") {
			score *= 1 - capped * 0.08;
		} else if (task.workType === "OPERATIONAL") {
			score *= 1 - capped * 0.03;
		} else {
			score *= 1 + capped * 0.04;
		}
	}

	if (context.localHour >= 17) {
		score *= task.workType === "DEEP_WORK" ? 0.85 : 1.1;
	}

	if (
		context.lastOverrideWorkType != null &&
		context.lastOverrideWorkType === task.workType
	) {
		score *= 1.15;
	}

	const remaining = context.remainingFocusMinutes;
	if (remaining != null && task.effortMinutes != null) {
		if (task.effortMinutes <= remaining) {
			score *= 1.15;
		} else {
			score *= 0.85;
		}
	}

	return score;
}

export function pickBestTask(
	tasks: ScoringTask[],
	context: ScoringContext,
): ScoringTask | null {
	if (tasks.length === 0) {
		return null;
	}

	return tasks.reduce((best, task) => {
		const taskScore = scoreTask(task, context);
		const bestScore = scoreTask(best, context);

		if (taskScore > bestScore) {
			return task;
		}
		if (taskScore < bestScore) {
			return best;
		}
		if (task.sortOrder < best.sortOrder) {
			return task;
		}
		if (task.sortOrder > best.sortOrder) {
			return best;
		}
		if (task.urgency > best.urgency) {
			return task;
		}
		if (task.urgency < best.urgency) {
			return best;
		}
		if (task.importance > best.importance) {
			return task;
		}
		if (task.importance < best.importance) {
			return best;
		}
		return task.createdAt < best.createdAt ? task : best;
	});
}
