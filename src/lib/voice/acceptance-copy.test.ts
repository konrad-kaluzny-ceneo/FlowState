import { describe, expect, it } from "vitest";

import {
	buildRationale,
	F14_ACCEPTANCE_RATIONALE_KEYS,
} from "~/lib/scoring/rationale";
import type { ScoringContext } from "~/lib/scoring/score-task";
import {
	buildDayMemoryCollapsedLine,
	getDayMemorySectionDone,
	getDayMemorySectionRemains,
	getDayMemorySectionReturnTo,
} from "~/lib/session/narrative-copy";

const baseContext: ScoringContext = {
	energy: "FADING",
	completedWorkCycles: 0,
	interruptionCount: 0,
	localHour: 14,
	lastOverrideWorkType: undefined,
};

// Home purpose header acceptance removed 2026-07-03 per D-07 (hero deleted;
// see product-voice.md §5-second purpose test for the amended contract).

describe("F-14 voice acceptance — first suggestion rationale", () => {
	it.each(
		F14_ACCEPTANCE_RATIONALE_KEYS,
	)("renders calm one-line %s in EN without punitive tone", (key) => {
		const line = buildRationale(key, baseContext, "en");
		expect(line.length).toBeGreaterThan(0);
		expect(line.length).toBeLessThanOrEqual(80);
		expect(line).not.toMatch(/streak|crush|hustle|fail/i);
	});

	it("renders target PL acceptance examples (not EN placeholders)", () => {
		expect(buildRationale("default", baseContext, "pl")).toBe(
			"Kolejny krok — zgodnie z energią i zadaniami na dziś",
		);
		expect(buildRationale("kickoff_fresh", baseContext, "pl")).toBe(
			"Nowa sesja — sensowny punkt startowy",
		);
		expect(buildRationale("low_effort_fit", baseContext, "pl")).toBe(
			"Szybki krok — pasuje przy słabnącej energii",
		);
	});

	it("keeps EN acceptance examples unchanged", () => {
		expect(buildRationale("default", baseContext, "en")).toBe(
			"Next up based on your energy and task mix",
		);
		expect(buildRationale("kickoff_fresh", baseContext, "en")).toBe(
			"Fresh session — here's a strong starting point",
		);
		expect(buildRationale("low_effort_fit", baseContext, "en")).toBe(
			"Quick win — fits your fading energy",
		);
	});
});

describe("F-14 voice acceptance — day memory closure", () => {
	it("exposes done / remains / return-to section labels in EN", () => {
		expect(getDayMemorySectionDone("en")).toBe("Done");
		expect(getDayMemorySectionRemains("en")).toBe("Remains");
		expect(getDayMemorySectionReturnTo("en")).toBe("Return to");
	});

	it("exposes Domknięte / Zostaje / Wróć tutaj in PL", () => {
		expect(getDayMemorySectionDone("pl")).toBe("Domknięte");
		expect(getDayMemorySectionRemains("pl")).toBe("Zostaje");
		expect(getDayMemorySectionReturnTo("pl")).toBe("Wróć tutaj");
	});

	it("builds collapsed recap line from batch-7 PL template", () => {
		expect(
			buildDayMemoryCollapsedLine(
				{
					done: "2 zadania",
					remaining: "3",
					next: "API review",
				},
				"pl",
			),
		).toBe("Zrobione: 2 zadania. Zostało: 3. Wróć spokojnie do: API review.");
	});

	it("builds collapsed recap line in EN within one-line budget", () => {
		const line = buildDayMemoryCollapsedLine(
			{
				done: "2 tasks",
				remaining: "3 open",
				next: "API review",
			},
			"en",
		);
		expect(line).toBe(
			"Done: 2 tasks. Remains: 3 open. Return calmly to: API review.",
		);
		expect(line.length).toBeLessThanOrEqual(120);
	});
});
