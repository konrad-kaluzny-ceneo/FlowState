import { describe, expect, it } from "vitest";

import {
	applyPersonaPresetToCreateState,
	TASK_PERSONA_PRESETS,
} from "./persona-presets";

describe("persona-presets", () => {
	it.each(
		TASK_PERSONA_PRESETS,
	)("applyPersonaPresetToCreateState maps $id to create form fields", (preset) => {
		expect(applyPersonaPresetToCreateState(preset.id)).toEqual({
			workType: preset.workType,
			urgency: preset.urgency,
			importance: preset.importance,
			effortMinutes: String(preset.effortMinutes),
			commitmentHorizon: preset.commitmentHorizon,
		});
	});

	it("throws for unknown preset id", () => {
		expect(() =>
			applyPersonaPresetToCreateState("unknown" as "deep-planning"),
		).toThrow("Unknown persona preset");
	});
});
