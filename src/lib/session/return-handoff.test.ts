import { afterEach, describe, expect, it } from "vitest";

import {
	composeReturnHandoffLine,
	findGuestLastEndedSession,
	handoffDismissStorageKey,
	isHandoffDismissed,
	markHandoffDismissed,
	pickHandoffTaskContext,
	readDismissedHandoffSessionIds,
	resolveContinueTaskId,
	shouldShowReturnHandoffForSession,
} from "./return-handoff";

const NINE_HOURS_MS = 9 * 60 * 60 * 1000;

describe("return-handoff storage", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("tracks dismissed session ids per ended session", () => {
		markHandoffDismissed("session-42");
		expect(isHandoffDismissed("session-42")).toBe(true);
		expect(readDismissedHandoffSessionIds()).toEqual(["session-42"]);
		expect(handoffDismissStorageKey("session-42")).toBe(
			"flowstate:handoff-dismissed:session-42",
		);
	});
});

describe("resolveContinueTaskId", () => {
	it("returns last focused task when still active", () => {
		expect(
			resolveContinueTaskId({ lastFocusedTaskId: 42 }, [
				{ id: 1, status: "active" },
				{ id: 42, status: "active" },
			]),
		).toBe(42);
	});

	it("returns null when last focused task is not active", () => {
		expect(
			resolveContinueTaskId({ lastFocusedTaskId: 42 }, [
				{ id: 42, status: "completed" },
			]),
		).toBeNull();
	});

	it("returns null when last ended session has no focus id", () => {
		expect(
			resolveContinueTaskId({ lastFocusedTaskId: null }, [
				{ id: 1, status: "active" },
			]),
		).toBeNull();
	});
});

describe("pickHandoffTaskContext", () => {
	it("prefers active task resume note over title-only fallback", () => {
		expect(
			pickHandoffTaskContext([
				{
					status: "active",
					title: "Write tests",
					resumeNote: "Left off at banner",
				},
				{ status: "active", title: "Other task", resumeNote: null },
			]),
		).toEqual({
			resumeNote: "Left off at banner",
			taskTitle: "Write tests",
		});
	});

	it("falls back to first active task title when no resume note", () => {
		expect(
			pickHandoffTaskContext([
				{ status: "completed", title: "Done", resumeNote: null },
				{ status: "active", title: "Continue here", resumeNote: null },
			]),
		).toEqual({
			resumeNote: null,
			taskTitle: "Continue here",
		});
	});
});

describe("findGuestLastEndedSession", () => {
	it("returns the most recently ended guest session", () => {
		const older = new Date("2026-06-10T08:00:00Z");
		const newer = new Date("2026-06-11T08:00:00Z");
		const result = findGuestLastEndedSession([
			{
				id: "a",
				state: "ENDED_BY_USER",
				startedAt: older,
				endedAt: older,
				lastActivityAt: older,
				interruptionCount: 0,
				closureLine: "Session complete — 1 cycle.",
			},
			{
				id: "b",
				state: "ENDED_BY_TIMEOUT",
				startedAt: newer,
				endedAt: newer,
				lastActivityAt: newer,
				interruptionCount: 0,
				closureLine: null,
			},
		]);

		expect(result?.id).toBe("b");
	});
});

describe("composeReturnHandoffLine", () => {
	it("composes resume note before closure line", () => {
		expect(
			composeReturnHandoffLine(
				{ closureLine: "Session complete — 2 cycles." },
				[
					{
						status: "active",
						title: "Wire banner",
						resumeNote: "Hook up dismiss",
					},
				],
			),
		).toBe("Left off: Hook up dismiss · Session complete — 2 cycles.");
	});
});

describe("shouldShowReturnHandoffForSession", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("shows after 8h and hides when dismissed", () => {
		const endedAt = new Date(Date.now() - NINE_HOURS_MS);
		expect(
			shouldShowReturnHandoffForSession({
				sessionId: 7,
				endedAt,
			}),
		).toBe(true);

		markHandoffDismissed(7);
		expect(
			shouldShowReturnHandoffForSession({
				sessionId: 7,
				endedAt,
			}),
		).toBe(false);
	});
});
