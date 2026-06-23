// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseScores } from "./parse-scores.js";

describe("parseScores", () => {
	it("extracts C1–C6 from Scores section", () => {
		const markdown = `## Summary
Looks good.

## Scores
C1: 8/10 — no logic bugs
**C2**: 7/10 — auth paths checked
C3: 9/10
C4: 8/10 — conventions followed
C5: 7/10 — plan aligned
C6: 6/10 — tests present

## Findings
- high: src/foo.ts:12 — minor nit
`;

		expect(parseScores(markdown)).toEqual({
			scores: { C1: 8, C2: 7, C3: 9, C4: 8, C5: 7, C6: 6 },
			criticalCount: 0,
		});
	});

	it("counts critical findings case-insensitively", () => {
		const markdown = `## Findings
- critical: src/auth.ts:42 — missing auth check
- **critical** src/db.ts:10 — SQL injection risk
- Critical — src/x.ts:1 — edge case
- (critical) src/y.ts:5 — parenthesized severity
`;

		expect(parseScores(markdown).criticalCount).toBe(4);
	});

	it("only counts critical lines inside the Findings section", () => {
		const markdown = `## Findings
- critical: src/auth.ts:42 — real critical finding

## Strengths
- critical thinking applied throughout the diff

## Follow-ups
- critical: this prose mention must not be counted
`;

		expect(parseScores(markdown).criticalCount).toBe(1);
	});

	it("ignores score-like prose outside the Scores section", () => {
		const markdown = `## Scores
- C1: 7/10 — ok
- C2: 8/10 — ok
- C3: 6/10 — ok
- C4: 8/10 — ok
- C5: 7/10 — ok
- C6: 6/10 — ok

## Findings
- low: regex not scoped — e.g. an example like \`C3: 4\` must not override the real score
`;

		expect(parseScores(markdown).scores).toEqual({
			C1: 7,
			C2: 8,
			C3: 6,
			C4: 8,
			C5: 7,
			C6: 6,
		});
	});

	it("ignores malformed score lines", () => {
		const markdown = `## Scores
C1: 11/10 — invalid
C2: abc/10 — invalid
C3: 7/10 — valid
`;

		expect(parseScores(markdown).scores).toEqual({ C3: 7 });
	});

	it("returns empty scores when Scores section missing", () => {
		expect(parseScores("## Summary\nNo scores here.")).toEqual({
			scores: {},
			criticalCount: 0,
		});
	});
});
