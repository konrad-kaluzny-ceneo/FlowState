import { describe, expect, it } from "vitest";
import { getPersonaPresetById } from "~/lib/task/persona-presets";

import {
	buildPersonaTrustClause,
	buildPersonaTrustClauseForTask,
	composeSuggestionRationale,
} from "./persona-trust-clause";

describe("buildPersonaTrustClause", () => {
	it("returns clause for each catalog preset", () => {
		expect(buildPersonaTrustClause("synchro")).toBe(
			"Synchro — operational work fits your choice.",
		);
		expect(buildPersonaTrustClause("firefight")).toBe(
			"Firefight — reactive work fits your choice.",
		);
		expect(buildPersonaTrustClause("focus")).toBe(
			"Focus — deep work matches how you framed this.",
		);
	});

	it("returns null for legacy tasks without preset", () => {
		expect(buildPersonaTrustClause(null)).toBeNull();
	});

	it("returns null for custom preset sentinel", () => {
		expect(buildPersonaTrustClause("custom")).toBeNull();
	});

	it("returns null for unknown catalog id", () => {
		expect(buildPersonaTrustClause("deep-planning")).toBeNull();
	});

	it("returns null when live attrs no longer match stored preset", () => {
		const preset = getPersonaPresetById("firefight");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			buildPersonaTrustClauseForTask({
				personaPresetId: "firefight",
				workType: preset.workType,
				urgency: 1,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: preset.effortMinutes,
			}),
		).toBeNull();
	});

	it("returns clause when attrs match a preset bundle", () => {
		const preset = getPersonaPresetById("synchro");
		expect(preset).toBeDefined();
		if (preset == null) {
			return;
		}

		expect(
			buildPersonaTrustClauseForTask({
				personaPresetId: null,
				workType: preset.workType,
				urgency: preset.urgency,
				importance: preset.importance,
				commitmentHorizon: preset.commitmentHorizon,
				effortMinutes: null,
			}),
		).toBe("Synchro — operational work fits your choice.");
	});
});

describe("composeSuggestionRationale", () => {
	it("prepends persona clause to scoring rationale", () => {
		expect(
			composeSuggestionRationale(
				"Deep work — you're focused with few interruptions",
				"Synchro — operational work fits your choice.",
			),
		).toBe(
			"Synchro — operational work fits your choice. Deep work — you're focused with few interruptions",
		);
	});

	it("returns scoring rationale unchanged when clause is null", () => {
		const scoring = "Fresh session — here's a strong starting point";
		expect(composeSuggestionRationale(scoring, null)).toBe(scoring);
	});
});
