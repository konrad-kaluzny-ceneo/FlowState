import { describe, expect, it } from "vitest";

import {
	type DeriveHomeSessionStateInput,
	deriveHomeSessionState,
	HOME_MODULE_KEYS,
	type HomeModuleKey,
} from "~/lib/home/home-session-state";

function baseInput(
	overrides: Partial<DeriveHomeSessionStateInput> = {},
): DeriveHomeSessionStateInput {
	return {
		dataMode: "authenticated",
		cycleKind: null,
		cycleState: "idle",
		wedgeGateActive: false,
		enableSuggestionGate: true,
		showSessionEnergy: false,
		showSessionFocus: false,
		pendingKickoffSuggestionStatus: "idle",
		pendingSuggestionStatus: "idle",
		focusedTaskId: null,
		continueTaskId: null,
		hasPreFocusedKickoff: false,
		workTypeDurationScopeAvailable: false,
		taskInventoryView: "list",
		recapAvailable: true,
		showInFlowSummary: false,
		showBreakTransitionLine: false,
		...overrides,
	};
}

function expectAllModuleKeysPresent(
	modules: Record<HomeModuleKey, string>,
): void {
	for (const key of HOME_MODULE_KEYS) {
		expect(modules[key], `missing priority for ${key}`).toBeDefined();
	}
}

function primaryNextFocusCount(modules: Record<HomeModuleKey, string>): number {
	return modules.nextFocus === "primary" ? 1 : 0;
}

describe("deriveHomeSessionState", () => {
	describe("session state taxonomy", () => {
		it("resolves idle when cycle is idle with no continue task or steering", () => {
			const { state } = deriveHomeSessionState(baseInput());
			expect(state).toBe("idle");
		});

		it("resolves steering when session energy or focus cards are visible", () => {
			const { state } = deriveHomeSessionState(
				baseInput({ showSessionEnergy: true }),
			);
			expect(state).toBe("steering");
		});

		it("resolves active_work during running WORK without wedge gate", () => {
			const { state } = deriveHomeSessionState(
				baseInput({
					cycleKind: "WORK",
					cycleState: "running",
					focusedTaskId: 1,
				}),
			);
			expect(state).toBe("active_work");
		});

		it("keeps paused WORK in active_work", () => {
			const { state, modules } = deriveHomeSessionState(
				baseInput({
					cycleKind: "WORK",
					cycleState: "paused",
					focusedTaskId: 1,
				}),
			);
			expect(state).toBe("active_work");
			expect(modules.timer).toBe("primary");
		});

		it("resolves break during running short break", () => {
			const { state } = deriveHomeSessionState(
				baseInput({
					cycleKind: "SHORT_BREAK",
					cycleState: "running",
				}),
			);
			expect(state).toBe("break");
		});

		it("resolves returning when continue task is set on idle home", () => {
			const { state } = deriveHomeSessionState(
				baseInput({
					continueTaskId: 42,
					showSessionEnergy: true,
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(state).toBe("returning");
		});
	});

	describe("guest vs authenticated", () => {
		it("does not elevate next focus for guest without suggestion gate", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					dataMode: "guest",
					enableSuggestionGate: false,
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(modules.nextFocus).toBe("hidden");
		});

		it("does not resolve steering for guest without suggestion gate", () => {
			const { state } = deriveHomeSessionState(
				baseInput({
					dataMode: "guest",
					enableSuggestionGate: false,
					showSessionEnergy: true,
				}),
			);
			expect(state).toBe("idle");
		});

		it("forces suggestion gate off for guest even when caller passes it enabled", () => {
			const { state, modules } = deriveHomeSessionState(
				baseInput({
					dataMode: "guest",
					enableSuggestionGate: true,
					showSessionEnergy: true,
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(state).toBe("idle");
			expect(modules.nextFocus).toBe("hidden");
		});
	});

	describe("module priority invariants", () => {
		it("hides recap during active work", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					cycleKind: "WORK",
					cycleState: "running",
					focusedTaskId: 1,
					recapAvailable: true,
				}),
			);
			expect(modules.recap).toBe("hidden");
			expect(modules.timer).toBe("primary");
		});

		it("keeps inventory secondary during active work", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					cycleKind: "WORK",
					cycleState: "running",
					focusedTaskId: 1,
				}),
			);
			expect(modules.inventory).toBe("secondary");
		});

		it("keeps archive secondary and hides list inventory when archive view is active", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					taskInventoryView: "archive",
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(modules.archive).toBe("secondary");
			expect(modules.inventory).toBe("hidden");
			expect(modules.nextFocus).toBe("primary");
		});

		it("never shows return handoff banner module", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					continueTaskId: 7,
					showSessionEnergy: true,
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(modules.returnBanner).toBe("hidden");
		});

		it("assigns exactly one primary next focus in idle when kickoff is available", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(primaryNextFocusCount(modules)).toBe(1);
			expect(modules.nextFocus).toBe("primary");
		});

		it("assigns steering as primary in returning while kickoff is blocked by steering", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					continueTaskId: 3,
					showSessionEnergy: true,
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(modules.steering).toBe("primary");
			expect(modules.nextFocus).toBe("hidden");
		});

		it("assigns exactly one primary next focus in returning when kickoff is available", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					continueTaskId: 3,
					pendingKickoffSuggestionStatus: "ready",
				}),
			);
			expect(primaryNextFocusCount(modules)).toBe(1);
			expect(modules.nextFocus).toBe("primary");
		});

		it("makes break suggestion primary while inventory stays secondary", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					cycleKind: "SHORT_BREAK",
					cycleState: "running",
					pendingSuggestionStatus: "ready",
				}),
			);
			expect(modules.nextFocus).toBe("primary");
			expect(modules.inventory).toBe("secondary");
		});

		it("makes timer primary on break without suggestion card", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({
					cycleKind: "LONG_BREAK",
					cycleState: "paused",
					pendingSuggestionStatus: "idle",
				}),
			);
			expect(modules.timer).toBe("primary");
			expect(modules.nextFocus).toBe("hidden");
		});

		it("makes steering primary during steering state", () => {
			const { modules } = deriveHomeSessionState(
				baseInput({ showSessionFocus: true }),
			);
			expect(modules.steering).toBe("primary");
		});

		it("includes a priority for every known module key", () => {
			const scenarios: Partial<DeriveHomeSessionStateInput>[] = [
				{},
				{ cycleKind: "WORK", cycleState: "running", focusedTaskId: 1 },
				{ cycleKind: "SHORT_BREAK", cycleState: "running" },
				{ showSessionEnergy: true },
				{
					continueTaskId: 1,
					pendingKickoffSuggestionStatus: "ready",
				},
				{ taskInventoryView: "archive" },
				{ dataMode: "guest", enableSuggestionGate: false },
			];

			for (const overrides of scenarios) {
				const { modules } = deriveHomeSessionState(baseInput(overrides));
				expectAllModuleKeysPresent(modules);
			}
		});
	});
});
