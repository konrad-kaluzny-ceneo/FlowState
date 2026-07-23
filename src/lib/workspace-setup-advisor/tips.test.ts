import { describe, expect, it } from "vitest";

import { filterKnownTipIds, isWorkspaceTipId, WORKSPACE_TIPS } from "./tips";

describe("workspace-setup-advisor tips", () => {
	it("exposes stable tip ids with categories", () => {
		expect(WORKSPACE_TIPS.length).toBeGreaterThanOrEqual(8);
		expect(WORKSPACE_TIPS.every((tip) => tip.id && tip.category)).toBe(true);
	});

	it("guards known tip ids", () => {
		expect(isWorkspaceTipId("cursor-agents")).toBe(true);
		expect(isWorkspaceTipId("legacy-removed-tip")).toBe(false);
	});

	it("filters unknown and duplicate ids", () => {
		expect(
			filterKnownTipIds([
				"cursor-agents",
				"gone",
				"cursor-agents",
				"slack-dnd",
			]),
		).toEqual(["cursor-agents", "slack-dnd"]);
	});
});
