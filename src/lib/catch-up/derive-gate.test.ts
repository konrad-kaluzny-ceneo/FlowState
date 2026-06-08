import { describe, expect, it } from "vitest";

import { deriveCatchUpGate } from "./derive-gate";

describe("deriveCatchUpGate", () => {
	it("returns CHECK_IN when awaiting check-in", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "WORK",
				awaitingCheckIn: true,
				pendingSuggestionStatus: "idle",
			}),
		).toBe("CHECK_IN");
	});

	it("returns WORK_CONFIRM when work cycle completed", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "WORK",
				awaitingCheckIn: false,
				pendingSuggestionStatus: "idle",
			}),
		).toBe("WORK_CONFIRM");
	});

	it("returns BREAK_CONFIRM for short break completion", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "SHORT_BREAK",
				awaitingCheckIn: false,
				pendingSuggestionStatus: "idle",
			}),
		).toBe("BREAK_CONFIRM");
	});

	it("returns BREAK_CONFIRM for long break completion", () => {
		expect(
			deriveCatchUpGate({
				state: "completed",
				cycleKind: "LONG_BREAK",
				awaitingCheckIn: false,
				pendingSuggestionStatus: "idle",
			}),
		).toBe("BREAK_CONFIRM");
	});

	it("returns SUGGESTION_ACCEPT when break running with ready suggestion", () => {
		expect(
			deriveCatchUpGate({
				state: "running",
				cycleKind: "SHORT_BREAK",
				awaitingCheckIn: false,
				pendingSuggestionStatus: "ready",
			}),
		).toBe("SUGGESTION_ACCEPT");
	});

	it("returns null when no gate applies", () => {
		expect(
			deriveCatchUpGate({
				state: "running",
				cycleKind: "WORK",
				awaitingCheckIn: false,
				pendingSuggestionStatus: "idle",
			}),
		).toBeNull();
	});
});
