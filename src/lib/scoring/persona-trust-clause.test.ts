import { describe, expect, it } from "vitest";

import {
	buildPersonaTrustClause,
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
