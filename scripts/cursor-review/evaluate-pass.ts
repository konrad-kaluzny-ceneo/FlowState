import type { CriterionId } from "./parse-scores.js";

const ALL_CRITERIA: CriterionId[] = ["C1", "C2", "C3", "C4", "C5", "C6"];

export type PassEvaluation = {
	passed: boolean;
	failReasons: string[];
	mean: number | null;
};

export type EvaluatePassInput = {
	scores: Partial<Record<CriterionId, number>>;
	criticalCount: number;
	hasPlanContext: boolean;
};

/**
 * Apply pass/fail rules from requirements.md.
 */
export function evaluatePass(input: EvaluatePassInput): PassEvaluation {
	const { scores, criticalCount, hasPlanContext } = input;
	const failReasons: string[] = [];

	const applicable = hasPlanContext
		? ALL_CRITERIA
		: ALL_CRITERIA.filter((id) => id !== "C5");

	const presentScores = applicable
		.map((id) => scores[id])
		.filter((n): n is number => n !== undefined);

	const missing = applicable.filter((id) => scores[id] === undefined);
	if (missing.length > 0) {
		failReasons.push(`missing scores: ${missing.join(", ")}`);
	}

	for (const id of applicable) {
		const value = scores[id];
		if (value !== undefined && value < 6) {
			failReasons.push(`${id} below threshold (${value}/10)`);
		}
	}

	if (criticalCount > 0) {
		failReasons.push(
			`${criticalCount} critical finding${criticalCount === 1 ? "" : "s"}`,
		);
	}

	const mean =
		presentScores.length > 0
			? presentScores.reduce((sum, n) => sum + n, 0) / presentScores.length
			: null;

	return {
		passed: failReasons.length === 0,
		failReasons,
		mean,
	};
}
