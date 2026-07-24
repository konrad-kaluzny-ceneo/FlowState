import { describe, expect, it } from "vitest";

import { filterKnownTipIds, isWorkspaceTipId, WORKSPACE_TIPS } from "./tips";

describe("workspace-setup-advisor tips", () => {
	it("exposes stable tip ids with categories", () => {
		expect(WORKSPACE_TIPS).toEqual([
			{ id: "cursor-agents", category: "editor" },
			{ id: "claude-agents", category: "editor" },
			{ id: "slack-dnd", category: "chat" },
			{ id: "teams-focus", category: "chat" },
			{ id: "browser-notifications", category: "notifications" },
			{ id: "email-batching", category: "notifications" },
			{ id: "phone-dnd", category: "device" },
			{ id: "os-focus", category: "device" },
		]);
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
