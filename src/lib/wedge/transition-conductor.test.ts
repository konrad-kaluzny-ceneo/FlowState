import { describe, expect, it } from "vitest";

import {
	computeKickoffEligible,
	effectiveWorkCyclesAtCheckIn,
	resolveWedgeBeat,
	type WedgeConductorInput,
} from "./transition-conductor";

const baseInput: WedgeConductorInput = {
	enableCheckInGate: true,
	enableWindDownGate: true,
	enableSuggestionGate: true,
	pendingClosureLine: null,
	awaitingCheckIn: false,
	awaitingWindDown: false,
	windDownRationale: null,
	awaitingKickoffReadiness: false,
	awaitingCycleIntention: false,
	isPostCheckInTransitioning: false,
	activeCycle: null,
	returnHandoffGateOpen: false,
	state: "idle",
};

describe("resolveWedgeBeat", () => {
	it("shows session closure over kickoff readiness (T-01)", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			pendingClosureLine: "Session complete — take a breath.",
			awaitingKickoffReadiness: true,
		});

		expect(result.activeGate).toBe("session_closure");
		expect(result.showSessionClosure).toBe(true);
		expect(result.showKickoffReadiness).toBe(false);
	});

	it("blocks kickoff when return handoff gate is open (pol-10 / T-06)", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			returnHandoffGateOpen: true,
			awaitingKickoffReadiness: true,
		});

		expect(result.showKickoffReadiness).toBe(false);
	});

	it("prefers wind-down over check-in", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
		});

		expect(result.activeGate).toBe("wind_down");
		expect(result.showWindDown).toBe(true);
		expect(result.showCheckIn).toBe(false);
	});

	it("prefers check-in over kickoff readiness", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			awaitingKickoffReadiness: true,
		});

		expect(result.activeGate).toBe("check_in");
		expect(result.showKickoffReadiness).toBe(false);
	});

	it("shows cycle complete when no higher gate active", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			state: "completed",
		});

		expect(result.activeGate).toBe("cycle_complete");
		expect(result.showCycleComplete).toBe(true);
	});
});

describe("computeKickoffEligible", () => {
	const baseKickoff = {
		mode: "authenticated" as const,
		state: "idle" as const,
		cycleKind: null,
		focusedTaskId: null,
		awaitingCheckIn: false,
		awaitingWindDown: false,
		isPostCheckInTransitioning: false,
		pendingSuggestionStatus: "idle",
		pendingClosureLine: null,
		hasActiveTasks: true,
		sessionStartIdleFlag: true,
		postBreakIdleFlag: false,
		returnHandoffGateOpen: false,
	};

	it("returns false when return handoff gate is open (pol-10)", () => {
		expect(
			computeKickoffEligible({
				...baseKickoff,
				returnHandoffGateOpen: true,
			}),
		).toBe(false);
	});

	it("returns false when closure pending", () => {
		expect(
			computeKickoffEligible({
				...baseKickoff,
				pendingClosureLine: "Session complete.",
			}),
		).toBe(false);
	});

	it("returns true on idle session start when unblocked", () => {
		expect(computeKickoffEligible(baseKickoff)).toBe(true);
	});
});

describe("effectiveWorkCyclesAtCheckIn", () => {
	it("adds one for post-work check-in (B-07)", () => {
		expect(effectiveWorkCyclesAtCheckIn(2)).toBe(3);
	});
});
