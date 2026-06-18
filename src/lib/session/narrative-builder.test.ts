import { describe, expect, it } from "vitest";

import {
	buildClosureLine,
	buildInFlowSummary,
	buildReturnHandoff,
	RETURN_HANDOFF_THRESHOLD_MS,
	shouldShowReturnHandoff,
} from "./narrative-builder";

describe("buildInFlowSummary", () => {
	it("joins cycles, tasks, and energy into one calm line", () => {
		expect(
			buildInFlowSummary({
				cyclesCompleted: 2,
				tasksCompleted: 1,
				latestEnergy: "STEADY",
				intention: null,
			}),
		).toBe("2 cycles · 1 task done · feeling steady");
	});

	it("appends intention when provided", () => {
		expect(
			buildInFlowSummary({
				cyclesCompleted: 1,
				tasksCompleted: 0,
				latestEnergy: "FOCUSED",
				intention: "Ship closure overlay",
			}),
		).toBe("1 cycle · feeling focused · Ship closure overlay");
	});

	it("returns null when session has no narrative signals yet", () => {
		expect(
			buildInFlowSummary({
				cyclesCompleted: 0,
				tasksCompleted: 0,
				latestEnergy: null,
				intention: null,
			}),
		).toBeNull();
	});

	it("uses singular cycle label for one cycle", () => {
		expect(
			buildInFlowSummary({
				cyclesCompleted: 1,
				tasksCompleted: 0,
				latestEnergy: null,
				intention: null,
			}),
		).toBe("1 cycle");
	});
});

describe("buildClosureLine", () => {
	it("summarizes session stats without comparative language", () => {
		expect(
			buildClosureLine({
				cyclesCompleted: 3,
				tasksCompleted: 2,
				latestEnergy: "FADING",
				endedBy: "user",
			}),
		).toBe("Session complete — 3 cycles, 2 tasks done. Feeling fading.");
	});

	it("uses the same tone for timeout-ended sessions", () => {
		expect(
			buildClosureLine({
				cyclesCompleted: 1,
				tasksCompleted: 0,
				latestEnergy: null,
				endedBy: "timeout",
			}),
		).toBe("Session complete — 1 cycle. Take a breath.");
	});

	it("mentions pause for pause-cap-ended sessions", () => {
		expect(
			buildClosureLine({
				cyclesCompleted: 2,
				tasksCompleted: 1,
				latestEnergy: "STEADY",
				endedBy: "pause_cap",
			}),
		).toBe(
			"Your pause ran long — session complete — 2 cycles, 1 task done. Feeling steady.",
		);
	});

	it("uses calm fallback copy for pause cap without energy", () => {
		expect(
			buildClosureLine({
				cyclesCompleted: 1,
				tasksCompleted: 0,
				latestEnergy: null,
				endedBy: "pause_cap",
			}),
		).toBe("Your pause ran long — session complete — 1 cycle. Take a breath.");
	});
});

describe("buildReturnHandoff", () => {
	it("prefers resume note as the first clause", () => {
		expect(
			buildReturnHandoff({
				closureLine: "Session complete — 2 cycles.",
				resumeNote: "Wire closure overlay",
				taskTitle: "Write tests",
			}),
		).toBe("Left off: Wire closure overlay · Session complete — 2 cycles.");
	});

	it("falls back to task title when resume note is absent", () => {
		expect(
			buildReturnHandoff({
				closureLine: "Session complete — 1 cycle.",
				resumeNote: null,
				taskTitle: "Write tests",
			}),
		).toBe("Continue: Write tests · Session complete — 1 cycle.");
	});

	it("returns null when there is nothing to hand off", () => {
		expect(
			buildReturnHandoff({
				closureLine: null,
				resumeNote: null,
				taskTitle: null,
			}),
		).toBeNull();
	});

	it("caps output at two clauses", () => {
		const line = buildReturnHandoff({
			closureLine: "Session complete — 3 cycles, 2 tasks done.",
			resumeNote: "Finish handoff banner",
			taskTitle: "Write tests",
		});

		expect(line?.split(" · ")).toHaveLength(2);
		expect(line).toContain("Left off: Finish handoff banner");
	});
});

describe("shouldShowReturnHandoff", () => {
	const eightHoursMs = RETURN_HANDOFF_THRESHOLD_MS;

	it("shows when ended more than 8 hours ago and not dismissed", () => {
		const endedAt = new Date(Date.now() - eightHoursMs - 60_000);

		expect(
			shouldShowReturnHandoff({
				endedAt,
				sessionId: 42,
				dismissedSessionIds: [],
			}),
		).toBe(true);
	});

	it("hides when within 8 hours", () => {
		const endedAt = new Date(Date.now() - 60_000);

		expect(
			shouldShowReturnHandoff({
				endedAt,
				sessionId: 42,
				dismissedSessionIds: [],
			}),
		).toBe(false);
	});

	it("hides when this session was already dismissed", () => {
		const endedAt = new Date(Date.now() - eightHoursMs - 60_000);

		expect(
			shouldShowReturnHandoff({
				endedAt,
				sessionId: 42,
				dismissedSessionIds: ["42"],
			}),
		).toBe(false);
	});
});
