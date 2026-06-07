import type { EnergyLevel, WorkType } from "../../../generated/prisma/client";

export type ScoringContext = {
	energy: EnergyLevel;
	completedWorkCycles: number;
	interruptionCount: number;
	localHour: number;
	lastOverrideWorkType?: WorkType;
};

export type ScoringTask = {
	id: number;
	workType: WorkType;
	weight: number;
	createdAt: Date;
};

export const TYPE_FIT: Record<EnergyLevel, Record<WorkType, number>> = {
	FOCUSED: { DEEP_WORK: 1.5, OPERATIONAL: 1.0, REACTIVE: 0.7 },
	STEADY: { DEEP_WORK: 1.1, OPERATIONAL: 1.2, REACTIVE: 1.0 },
	FADING: { DEEP_WORK: 0.6, OPERATIONAL: 1.3, REACTIVE: 1.4 },
};

export function scoreTask(task: ScoringTask, context: ScoringContext): number {
	let score = task.weight;

	score *= TYPE_FIT[context.energy][task.workType];

	if (context.completedWorkCycles >= 4) {
		score *= task.workType === "DEEP_WORK" ? 0.75 : 1.1;
	} else if (context.completedWorkCycles >= 2) {
		score *= task.workType === "DEEP_WORK" ? 0.9 : 1.05;
	}

	score *= Math.max(0.7, 1 - context.interruptionCount * 0.1);

	if (context.localHour >= 17) {
		score *= task.workType === "DEEP_WORK" ? 0.85 : 1.1;
	}

	if (
		context.lastOverrideWorkType != null &&
		context.lastOverrideWorkType === task.workType
	) {
		score *= 1.15;
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
		if (task.weight > best.weight) {
			return task;
		}
		if (task.weight < best.weight) {
			return best;
		}
		return task.createdAt < best.createdAt ? task : best;
	});
}
