import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKSPACE_SETUP_KEY_GUEST, workspaceSetupKeyForScope } from "./keys";
import {
	readWorkspaceSetupState,
	toggleDoneTip,
	writeDoneTipIds,
	writeNudgeDismissed,
} from "./storage";
import { DEFAULT_WORKSPACE_SETUP_STATE } from "./types";

describe("workspace-setup-advisor storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns defaults when nothing stored", () => {
		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual(
			DEFAULT_WORKSPACE_SETUP_STATE,
		);
	});

	it("round-trips done tips and nudge flag", () => {
		writeDoneTipIds({ mode: "guest" }, ["cursor-agents", "slack-dnd"]);
		writeNudgeDismissed({ mode: "guest" }, true);

		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual({
			doneTipIds: ["cursor-agents", "slack-dnd"],
			nudgeDismissed: true,
		});
	});

	it("filters unknown tip ids on read", () => {
		localStorage.setItem(
			WORKSPACE_SETUP_KEY_GUEST,
			JSON.stringify({
				v: 1,
				doneTipIds: ["cursor-agents", "legacy-removed-tip", "slack-dnd"],
				nudgeDismissed: false,
			}),
		);

		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual({
			doneTipIds: ["cursor-agents", "slack-dnd"],
			nudgeDismissed: false,
		});
	});

	it("toggles a tip on and off", () => {
		const added = toggleDoneTip({ mode: "guest" }, "os-focus");
		expect(added.doneTipIds).toEqual(["os-focus"]);

		const removed = toggleDoneTip({ mode: "guest" }, "os-focus");
		expect(removed.doneTipIds).toEqual([]);
	});

	it("isolates guest and auth keys per userId", () => {
		writeDoneTipIds({ mode: "guest" }, ["cursor-agents"]);
		writeDoneTipIds({ mode: "authenticated", userId: "user-a" }, ["slack-dnd"]);
		writeNudgeDismissed({ mode: "authenticated", userId: "user-b" }, true);

		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual({
			doneTipIds: ["cursor-agents"],
			nudgeDismissed: false,
		});
		expect(
			readWorkspaceSetupState({ mode: "authenticated", userId: "user-a" }),
		).toEqual({
			doneTipIds: ["slack-dnd"],
			nudgeDismissed: false,
		});
		expect(
			readWorkspaceSetupState({ mode: "authenticated", userId: "user-b" }),
		).toEqual({
			doneTipIds: [],
			nudgeDismissed: true,
		});

		expect(workspaceSetupKeyForScope({ mode: "guest" })).toBe(
			WORKSPACE_SETUP_KEY_GUEST,
		);
		expect(
			workspaceSetupKeyForScope({
				mode: "authenticated",
				userId: "user-a",
			}),
		).toBe("flowstate:workspaceSetupAdvisor:user-a");
	});

	it("returns defaults and skips writes for missing auth userId", () => {
		expect(
			workspaceSetupKeyForScope({ mode: "authenticated", userId: "" }),
		).toBeNull();

		writeDoneTipIds({ mode: "authenticated", userId: "" }, ["cursor-agents"]);
		writeNudgeDismissed({ mode: "authenticated", userId: "" }, true);

		expect(localStorage.length).toBe(0);
		expect(
			readWorkspaceSetupState({ mode: "authenticated", userId: "" }),
		).toEqual(DEFAULT_WORKSPACE_SETUP_STATE);
	});

	it("returns defaults for corrupt JSON", () => {
		localStorage.setItem(WORKSPACE_SETUP_KEY_GUEST, "not-json");
		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual(
			DEFAULT_WORKSPACE_SETUP_STATE,
		);
	});
});

describe("workspace-setup-advisor storage SSR guard", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns defaults on read and no-ops on write without window", () => {
		vi.stubGlobal("window", undefined);

		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual(
			DEFAULT_WORKSPACE_SETUP_STATE,
		);

		expect(writeDoneTipIds({ mode: "guest" }, ["cursor-agents"])).toEqual({
			...DEFAULT_WORKSPACE_SETUP_STATE,
			doneTipIds: ["cursor-agents"],
		});

		expect(writeNudgeDismissed({ mode: "guest" }, true)).toEqual({
			...DEFAULT_WORKSPACE_SETUP_STATE,
			nudgeDismissed: true,
		});
	});
});
