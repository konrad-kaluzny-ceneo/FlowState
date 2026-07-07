import { describe, expect, it } from "vitest";

import { deriveCatchUpGate } from "./derive-gate";

describe("deriveCatchUpGate", () => {
	it("returns CHECK_IN when awaiting check-in", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "WORK",
				awaitingCheckIn: true,
			}),
		).toBe("CHECK_IN");
	});

	it("returns WORK_CONFIRM when work cycle completed", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "WORK",
				awaitingCheckIn: false,
			}),
		).toBe("WORK_CONFIRM");
	});

	it("returns BREAK_CONFIRM for short break completion", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "SHORT_BREAK",
				awaitingCheckIn: false,
			}),
		).toBe("BREAK_CONFIRM");
	});

	it("returns BREAK_CONFIRM for long break completion", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "LONG_BREAK",
				awaitingCheckIn: false,
			}),
		).toBe("BREAK_CONFIRM");
	});

	it("returns null when break is running (no suggestion gate)", () => {
		expect(
			deriveCatchUpGate({
				state: "running",
				cycleKind: "SHORT_BREAK",
				awaitingCheckIn: false,
			}),
		).toBeNull();
	});

	it("returns null when no gate applies", () => {
		expect(
			deriveCatchUpGate({
				state: "running",
				cycleKind: "WORK",
				awaitingCheckIn: false,
			}),
		).toBeNull();
	});

	it("returns null when cycle is paused (pol-12)", () => {
		expect(
			deriveCatchUpGate({
				state: "paused",
				cycleKind: "SHORT_BREAK",
				awaitingCheckIn: true,
			}),
		).toBeNull();
		expect(
			deriveCatchUpGate({
				state: "running",
				cycleKind: "SHORT_BREAK",
				awaitingCheckIn: false,
				cyclePaused: true,
			}),
		).toBeNull();
	});
});
