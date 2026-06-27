import { describe, expect, it } from "vitest";

import {
	applyPersonaPresetToCreateState,
	getPersonaPresetById,
	getPersonaPresetLabel,
	getTaskBadgeDisplayMode,
	PERSONA_PRESET_CUSTOM_ID,
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

	it("getTaskBadgeDisplayMode returns legacy for null personaPresetId", () => {
		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: null,
				workType: "OPERATIONAL",
				urgency: 2,
				importance: 2,
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

	it("getTaskBadgeDisplayMode returns custom-detail for unknown stored id", () => {
		expect(
			getTaskBadgeDisplayMode({
				personaPresetId: "deep-planning",
				workType: "DEEP_WORK",
				urgency: 2,
				importance: 3,
				commitmentHorizon: "THIS_WEEK",
				effortMinutes: 60,
			}),
		).toBe("custom-detail");
	});

	it("getTaskBadgeDisplayMode returns custom-detail when non-effort attrs diverge", () => {
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
});
