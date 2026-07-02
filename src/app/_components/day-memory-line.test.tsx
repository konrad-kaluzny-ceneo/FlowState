import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DailyRecap } from "~/lib/recap/types";

import { DayMemoryLine } from "./day-memory-line";

function buildRecap(overrides: Partial<DailyRecap> = {}): DailyRecap {
	return {
		last24Hours: [],
		todayPlan: [],
		footprints: {},
		...overrides,
	};
}

const sampleRecap: DailyRecap = buildRecap({
	last24Hours: [
		{
			taskId: "t1",
			title: "Write tests",
			firstStartedAt: new Date("2026-07-02T08:00:00Z"),
			lastEndedAt: new Date("2026-07-02T09:00:00Z"),
			focusedMinutes: 45,
		},
	],
	todayPlan: [
		{
			taskId: "t2",
			title: "API review",
			isDailyStanding: false,
			doneForToday: false,
			effortMinutes: 30,
		},
	],
});

const sampleTasks = [
	{
		id: "t9",
		status: "active",
		title: "Ship feature",
		resumeNote: "Check the pagination edge case",
	},
];

describe("DayMemoryLine", () => {
	it("renders the collapsed line always visible when hasContent is true", () => {
		render(
			<DayMemoryLine
				continueTaskId="t9"
				recap={sampleRecap}
				tasks={sampleTasks}
			/>,
		);

		expect(screen.getByTestId("day-memory-line")).toBeTruthy();
		expect(screen.getByTestId("day-memory-collapsed").textContent).toBe(
			"Done: 1 task. Remains: 1 open. Return calmly to: Ship feature.",
		);
		expect(screen.queryByTestId("day-memory-expanded")).toBeNull();
	});

	it("expands to reveal exactly three narrative sections on toggle", () => {
		render(
			<DayMemoryLine
				continueTaskId="t9"
				recap={sampleRecap}
				tasks={sampleTasks}
			/>,
		);

		const toggle = screen.getByTestId("day-memory-toggle");
		expect(toggle.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(toggle);

		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		const expanded = screen.getByTestId("day-memory-expanded");
		expect(expanded.textContent).toContain("Write tests");
		expect(expanded.textContent).toContain("API review");
		expect(expanded.textContent).toContain("Ship feature");
		expect(expanded.textContent).toContain("Check the pagination edge case");
	});

	it("does not render rowFormat-style minute/timestamp text in the expanded output", () => {
		render(
			<DayMemoryLine
				continueTaskId="t9"
				recap={sampleRecap}
				tasks={sampleTasks}
			/>,
		);

		fireEvent.click(screen.getByTestId("day-memory-toggle"));

		const expanded = screen.getByTestId("day-memory-expanded");
		expect(expanded.textContent).not.toMatch(/\d+m/);
		expect(expanded.textContent).not.toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/);
	});

	it("returns null when hasContent is false", () => {
		render(
			<DayMemoryLine continueTaskId={null} recap={buildRecap()} tasks={[]} />,
		);

		expect(screen.queryByTestId("day-memory-line")).toBeNull();
	});

	it("returns null while loading even when content would otherwise exist", () => {
		render(
			<DayMemoryLine
				continueTaskId="t9"
				isLoading
				recap={sampleRecap}
				tasks={sampleTasks}
			/>,
		);

		expect(screen.queryByTestId("day-memory-line")).toBeNull();
	});
});
