export type CriterionId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";

export type ParsedScores = {
	scores: Partial<Record<CriterionId, number>>;
	criticalCount: number;
};

const SCORE_LINE = /(?:\*\*)?(C[1-6])(?:\*\*)?:\s*(\d{1,2})(?:\/10)?/gi;

const CRITICAL_FINDING =
	/^\s*(?:[-*]\s*)?(?:\(\s*)?(?:\*\*)?critical(?:\*\*)?(?:\s*\))?(?:\s*[:—–-]|\s+)/i;

/**
 * Extract C1–C6 scores and count critical findings from review markdown.
 */
export function parseScores(markdown: string): ParsedScores {
	const scores: Partial<Record<CriterionId, number>> = {};
	let criticalCount = 0;

	for (const match of markdown.matchAll(SCORE_LINE)) {
		const id = match[1] as CriterionId;
		const value = Number.parseInt(match[2] ?? "", 10);
		if (value >= 1 && value <= 10) {
			scores[id] = value;
		}
	}

	let inFindings = false;
	for (const line of markdown.split("\n")) {
		if (/^#{1,3}\s*\*?\*?Findings\*?\*?/i.test(line)) {
			inFindings = true;
			continue;
		}
		if (inFindings && /^#{1,3}\s+\S/.test(line)) {
			break;
		}
		if (!inFindings) {
			continue;
		}
		if (CRITICAL_FINDING.test(line)) {
			criticalCount += 1;
		}
	}

	return { scores, criticalCount };
}
