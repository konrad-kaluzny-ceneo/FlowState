import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guardrail (S-43 Phase 3): illustrations never render on wedge gates.
 *
 * The 7 wedge gate / gate-primitive files must never import from the
 * illustrations module (`~/lib/design/illustrations/...`) nor from the
 * home-illustration-variant context module — gates must not render
 * illustrations, and gate code must not couple to illustration state.
 * This turns S-39's by-omission boundary into an enforced contract.
 */

const WEDGE_GATE_FILES = [
	"check-in-overlay.tsx",
	"cycle-complete-overlay.tsx",
	"wind-down-overlay.tsx",
	"session-closure-overlay.tsx",
	"task-suggestion-card.tsx",
	"kickoff-duration-chips.tsx",
	"overlay-shell.tsx",
] as const;

const FORBIDDEN_IMPORT_PATTERNS = [
	// Barrel or any individual illustration module, via alias or relative path.
	"design/illustrations",
	// Illustration-variant context module (gates must never watch or publish
	// illustration variant state).
	"design/home-illustration-variant",
] as const;

// Vitest runs with cwd at the repo root; the existence assertion below
// fails loudly if that assumption (or a gate file path) ever breaks.
const gateFilePath = (fileName: string): string =>
	join(process.cwd(), "src", "app", "_components", fileName);

describe("no illustrations on wedge gates (S-43 guardrail)", () => {
	it.each(
		WEDGE_GATE_FILES,
	)("%s exists and contains no illustration imports", (fileName) => {
		const filePath = gateFilePath(fileName);

		// Guard against silent passes: a typo'd/moved gate file that never
		// matches would otherwise make this guardrail vacuous.
		expect(
			existsSync(filePath),
			`Wedge gate file not found on disk: ${filePath}. ` +
				"If the gate was renamed or moved, update WEDGE_GATE_FILES in " +
				"no-illustrations-on-gates.test.ts so the guardrail keeps scanning it.",
		).toBe(true);

		const source = readFileSync(filePath, "utf8");

		for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
			expect(
				source.includes(pattern),
				`Wedge gate file "${fileName}" references forbidden module path ` +
					`"${pattern}". Illustrations must never render on S-39 wedge ` +
					"gates, and gates must never couple to illustration-variant " +
					"state (roadmap S-43 acceptance: hero/rail only).",
			).toBe(false);
		}
	});
});
