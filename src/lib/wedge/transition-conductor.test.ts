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
	awaitingBreakChoice: false,
	awaitingWindDown: false,
	windDownRationale: null,
	isPostCheckInTransitioning: false,
	activeCycle: null,
	cyclePaused: false,
	state: "idle",
};

describe("resolveWedgeBeat", () => {
	it("shows session closure on idle entry (T-01)", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			pendingClosureLine: "Session complete — take a breath.",
		});

		expect(result.activeGate).toBe("session_closure");
		expect(result.showSessionClosure).toBe(true);
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

	it("shows check-in when no higher gate active", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
		});

		expect(result.activeGate).toBe("check_in");
	});

	it("shows cycle complete when no higher gate active", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			state: "completed",
		});

		expect(result.activeGate).toBe("cycle_complete");
		expect(result.showCycleComplete).toBe(true);
	});

	it("prefers cycle complete over stale session closure during work beat", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			pendingClosureLine: "Session complete — 2 cycles. Take a breath.",
			state: "completed",
			activeCycle: { id: 42 },
		});

		expect(result.activeGate).toBe("cycle_complete");
		expect(result.showSessionClosure).toBe(false);
		expect(result.showCycleComplete).toBe(true);
	});

	it("prefers check-in over stale session closure after cycle complete confirm", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			pendingClosureLine: "Session complete — 2 cycles. Take a breath.",
			state: "completed",
			activeCycle: { id: 42 },
			awaitingCheckIn: true,
		});

		expect(result.activeGate).toBe("check_in");
		expect(result.showSessionClosure).toBe(false);
		expect(result.showCheckIn).toBe(true);
	});

	it("suppresses all gates when cycle is paused (pol-12)", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			cyclePaused: true,
			pendingClosureLine: "Session complete — take a breath.",
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			awaitingBreakChoice: true,
			activeCycle: { id: 1 },
			state: "completed",
		});

		expect(result.activeGate).toBe("none");
		expect(result.showSessionClosure).toBe(false);
		expect(result.showWindDown).toBe(false);
		expect(result.showCheckIn).toBe(false);
		expect(result.showBreakChoice).toBe(false);
		expect(result.showCycleComplete).toBe(false);
	});

	it("shows break_choice when awaitingBreakChoice and no higher gate active", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			awaitingBreakChoice: true,
			state: "completed",
		});

		expect(result.activeGate).toBe("break_choice");
		expect(result.showBreakChoice).toBe(true);
		expect(result.showCycleComplete).toBe(false);
	});

	it("prefers check_in over break_choice", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			awaitingCheckIn: true,
			awaitingBreakChoice: true,
			activeCycle: { id: 1 },
			state: "completed",
		});

		expect(result.activeGate).toBe("check_in");
		expect(result.showCheckIn).toBe(true);
		expect(result.showBreakChoice).toBe(false);
	});

	it("prefers break_choice over cycle_complete", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			awaitingBreakChoice: true,
			state: "completed",
		});

		expect(result.activeGate).toBe("break_choice");
		expect(result.showBreakChoice).toBe(true);
		expect(result.showCycleComplete).toBe(false);
	});

	it("suppresses break_choice when cycle is paused", () => {
		const result = resolveWedgeBeat({
			...baseInput,
			cyclePaused: true,
			awaitingBreakChoice: true,
			state: "completed",
		});

		expect(result.activeGate).toBe("none");
		expect(result.showBreakChoice).toBe(false);
	});
});

describe("resolveWedgeBeat mutual-exclusion matrix (Risk #8)", () => {
	function countTrueGates(result: ReturnType<typeof resolveWedgeBeat>): number {
		return [
			result.showSessionClosure,
			result.showWindDown,
			result.showCheckIn,
			result.showBreakChoice,
			result.showCycleComplete,
		].filter(Boolean).length;
	}

	const mutexMatrix: WedgeConductorInput[] = [
		{
			...baseInput,
			cyclePaused: true,
			pendingClosureLine: "Session complete — take a breath.",
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			state: "completed",
		},
		{
			...baseInput,
			pendingClosureLine: "Session complete — take a breath.",
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			state: "completed",
		},
		{
			...baseInput,
			enableSuggestionGate: true,
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			state: "completed",
			isPostCheckInTransitioning: false,
		},
		{
			...baseInput,
			enableSuggestionGate: true,
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			state: "completed",
			isPostCheckInTransitioning: true,
		},
		{
			...baseInput,
			pendingClosureLine: "Session complete — take a breath.",
			state: "idle",
			activeCycle: null,
		},
		{
			...baseInput,
			pendingClosureLine: "Session complete — 2 cycles. Take a breath.",
			state: "completed",
			activeCycle: { id: 42 },
			awaitingCheckIn: true,
		},
		{
			...baseInput,
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			state: "completed",
			isPostCheckInTransitioning: true,
		},
		{
			...baseInput,
			enableCheckInGate: false,
			enableWindDownGate: false,
			awaitingWindDown: true,
			windDownRationale: "You've been at it for a while.",
			awaitingCheckIn: true,
			activeCycle: { id: 1 },
			state: "completed",
		},
	];

	it.each(
		mutexMatrix,
	)("exposes at most one gate boolean for candidate %#", (input) => {
		const result = resolveWedgeBeat(input);
		expect(countTrueGates(result)).toBeLessThanOrEqual(1);
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
		pendingClosureLine: null,
		hasActiveTasks: true,
		sessionStartIdleFlag: true,
		postBreakIdleFlag: false,
		cyclePaused: false,
	};

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

	it("returns false when cycle is paused (pol-12)", () => {
		expect(
			computeKickoffEligible({
				...baseKickoff,
				cyclePaused: true,
			}),
		).toBe(false);
		expect(
			computeKickoffEligible({
				...baseKickoff,
				state: "paused",
			}),
		).toBe(false);
	});
});

describe("effectiveWorkCyclesAtCheckIn", () => {
	it("adds one for post-work check-in (B-07)", () => {
		expect(effectiveWorkCyclesAtCheckIn(2)).toBe(3);
	});
});
