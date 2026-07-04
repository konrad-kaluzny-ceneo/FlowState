import { describe, expect, it } from "vitest";

import {
	applyPersonaPresetToCreateState,
	findMatchingPersonaPresetId,
	getPersonaPresetById,
	getPersonaPresetLabel,
	getTaskBadgeDisplayMode,
	PERSONA_PRESET_CUSTOM_ID,
	resolveTaskPersonaBadge,
	TASK_PERSONA_PRESETS,
	taskAttributesMatchPreset,
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
		expect(() => applyPersonaPresetToCreateState("unknown" as "focus")).toThrow(
			"Unknown persona preset",
		);
	});

	it("getPersonaPresetById resolves catalog entries", () => {
		expect(getPersonaPresetById("synchro")?.id).toBe("synchro");
		expect(getPersonaPresetById("removed-id")).toBeUndefined();
	});

	it("getPersonaPresetLabel returns label or undefined", () => {
		expect(getPersonaPresetLabel("focus")).toBe("Focus");
		expect(getPersonaPresetLabel("missing")).toBeUndefined();
	});

	it("taskAttributesMatchPreset matches effort when ignoreEffort is false", () => {
		const preset = getPersonaPresetById("focus");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			taskAttributesMatchPreset(
				{
					workType: preset.workType,
					urgency: preset.urgency,
					importance: preset.importance,
					commitmentHorizon: preset.commitmentHorizon,
					effortMinutes: preset.effortMinutes,
				},
				"focus",
			),
		).toBe(true);

		expect(
			taskAttributesMatchPreset(
				{
					workType: preset.workType,
					urgency: preset.urgency,
					importance: preset.importance,
					commitmentHorizon: preset.commitmentHorizon,
					effortMinutes: preset.effortMinutes + 5,
				},
				"focus",
			),
		).toBe(false);
	});

	it("taskAttributesMatchPreset ignores effort when ignoreEffort is true", () => {
		const preset = getPersonaPresetById("synchro");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			taskAttributesMatchPreset(
				{
					workType: preset.workType,
					urgency: preset.urgency,
					importance: preset.importance,
					commitmentHorizon: preset.commitmentHorizon,
					effortMinutes: 20,
				},
				"synchro",
				{ ignoreEffort: true },
			),
		).toBe(true);
	});

	it("taskAttributesMatchPreset fails when urgency diverges", () => {
		const preset = getPersonaPresetById("focus");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			taskAttributesMatchPreset(
				{
					workType: preset.workType,
					urgency: 1,
					importance: preset.importance,
					commitmentHorizon: preset.commitmentHorizon,
					effortMinutes: preset.effortMinutes,
				},
				"focus",
				{ ignoreEffort: true },
			),
		).toBe(false);
	});

	it("getTaskBadgeDisplayMode returns legacy when attrs match no preset", () => {
		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: null,
				workType: "DEEP_WORK",
				urgency: 3,
				importance: 1,
				commitmentHorizon: "WHEN_POSSIBLE",
				effortMinutes: null,
			}),
		).toBe("legacy");
	});

	it("getTaskBadgeDisplayMode returns persona when attrs match preset", () => {
		const preset = getPersonaPresetById("focus");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: "focus",
				workType: preset.workType,
				urgency: preset.urgency,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: 20,
			}),
		).toBe("persona");
	});

	it("getTaskBadgeDisplayMode returns custom-detail for custom sentinel", () => {
		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: PERSONA_PRESET_CUSTOM_ID,
				workType: "OPERATIONAL",
				urgency: 2,
				importance: 2,
				commitmentHorizon: "WHEN_POSSIBLE",
				effortMinutes: null,
			}),
		).toBe("custom-detail");
	});

	it("getTaskBadgeDisplayMode returns custom-detail for unknown stored id when attrs match no preset", () => {
		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: "deep-planning",
				workType: "DEEP_WORK",
				urgency: 3,
				importance: 1,
				commitmentHorizon: "WHEN_POSSIBLE",
				effortMinutes: 5,
			}),
		).toBe("custom-detail");
	});

	it("getTaskBadgeDisplayMode returns persona for unknown stored id when attrs match a preset", () => {
		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: "deep-planning",
				workType: "DEEP_WORK",
				urgency: 2,
				importance: 3,
				commitmentHorizon: "THIS_WEEK",
				effortMinutes: 60,
			}),
		).toBe("persona");
	});

	it("getTaskBadgeDisplayMode returns custom-detail when non-effort attrs diverge from stored preset", () => {
		const preset = getPersonaPresetById("focus");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: "focus",
				workType: preset.workType,
				urgency: 1,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: preset.effortMinutes,
			}),
		).toBe("custom-detail");
	});

	it("findMatchingPersonaPresetId resolves preset from current attributes", () => {
		const preset = getPersonaPresetById("firefight");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			findMatchingPersonaPresetId({
				workType: preset.workType,
				urgency: preset.urgency,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: 99,
			}),
		).toBe("firefight");
	});

	it("getTaskBadgeDisplayMode returns persona when attrs match preset without stored id", () => {
		const preset = getPersonaPresetById("synchro");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: null,
				workType: preset.workType,
				urgency: preset.urgency,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: null,
			}),
		).toBe("persona");
	});

	it("resolveTaskPersonaBadge returns matching preset id for label lookup", () => {
		const preset = getPersonaPresetById("firefight");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			resolveTaskPersonaBadge({
				personaPresetId: "focus",
				workType: preset.workType,
				urgency: preset.urgency,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: preset.effortMinutes,
			}),
		).toEqual({ mode: "persona", presetId: "firefight" });
	});
});
