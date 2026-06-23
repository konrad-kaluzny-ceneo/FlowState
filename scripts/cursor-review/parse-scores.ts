export type CriterionId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";

export type ParsedScores = {
	scores: Partial<Record<CriterionId, number>>;
	criticalCount: number;
};

// Anchored to line start so score-like text mid-sentence (e.g. an example
// `C3: 4` inside a finding) cannot be mistaken for a real score line.
const SCORE_LINE =
	/^\s*(?:[-*]\s*)?(?:\*\*)?(C[1-6])(?:\*\*)?:\s*(\d{1,2})(?:\/10)?/i;

const SECTION_HEADING = /^#{1,3}\s+\S/;

const CRITICAL_FINDING =
	/^\s*(?:[-*]\s*)?(?:\(\s*)?(?:\*\*)?critical(?:\*\*)?(?:\s*\))?(?:\s*[:—–-]|\s+)/i;

/**
 * Extract C1–C6 scores and count critical findings from review markdown.
 */
export function parseScores(markdown: string): ParsedScores {
	const scores: Partial<Record<CriterionId, number>> = {};
	let criticalCount = 0;

	const lines = markdown.split("\n");

	// Parse scores only within the Scores section, so score-like prose in
	// Findings cannot overwrite the real scores. Fall back to a line-anchored
	// scan of the whole document when no Scores heading is present.
	const scoresStart = lines.findIndex((line) =>
		/^#{1,3}\s*\*?\*?Scores\*?\*?/i.test(line),
	);
	let scoreLines: string[];
	if (scoresStart >= 0) {
		scoreLines = [];
		for (const line of lines.slice(scoresStart + 1)) {
			if (SECTION_HEADING.test(line)) {
				break;
			}
			scoreLines.push(line);
		}
	} else {
		scoreLines = lines;
	}

	for (const line of scoreLines) {
		const match = SCORE_LINE.exec(line);
		if (match) {
			const id = match[1] as CriterionId;
			const value = Number.parseInt(match[2] ?? "", 10);
			if (value >= 1 && value <= 10) {
				scores[id] = value;
			}
		}
	}

	let inFindings = false;
	for (const line of lines) {
		if (/^#{1,3}\s*\*?\*?Findings\*?\*?/i.test(line)) {
			inFindings = true;
			continue;
		}
		if (inFindings && SECTION_HEADING.test(line)) {
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
