import type { ScoringTask } from "./score-task";

/**
 * Delegation scoring has no session-context dependency (no energy/fatigue/
 * time-of-day factors) — it is independent of the Fokus suggestion pipeline
 * in `score-task.ts`. See plan.md "Critical Implementation Details" for why
 * DEEP_WORK is a hard exclusion rather than a soft multiplier.
 */
export type DelegationCandidateTask = Pick<
	ScoringTask,
	| "id"
	| "workType"
	| "effortMinutes"
	| "commitmentHorizon"
	| "importance"
	| "urgency"
	| "sortOrder"
	| "createdAt"
>;

export function scoreDelegationCandidate(
	task: DelegationCandidateTask,
): number {
	let score = 1.0;

	if (task.effortMinutes != null && task.effortMinutes <= 30) {
		score *= 1.2;
	}

	if (task.commitmentHorizon === "WHEN_POSSIBLE") {
		score *= 1.15;
	}

	// importance/urgency are always 1-3 per the domain type, so this never
	// divides by zero.
	score /= task.importance * task.urgency;

	return score;
}

export function pickDelegationCandidate(
	tasks: DelegationCandidateTask[],
): DelegationCandidateTask | null {
	// DEEP_WORK must never enter the candidate pool at all — a naive score
	// multiplier is dominated by the ÷(importance × urgency) term, which would
	// let a low-priority DEEP_WORK task out-score a genuinely delegatable one.
	const eligible = tasks.filter((task) => task.workType !== "DEEP_WORK");

	if (eligible.length === 0) {
		return null;
	}

	return eligible.reduce((best, task) => {
		const taskScore = scoreDelegationCandidate(task);
		const bestScore = scoreDelegationCandidate(best);

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
