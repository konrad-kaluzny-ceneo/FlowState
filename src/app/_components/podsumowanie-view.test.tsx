import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PodsumowanieView } from "~/app/_components/podsumowanie-view";
import type { DayStats } from "~/lib/recap/aggregate-day-stats";
import type { RecapTaskRow } from "~/lib/recap/types";

// next-intl is globally mocked by src/test/setup.ts; no wrapper needed.

const emptyStats: DayStats = {
	tasksWithFocusCount: 0,
	doneTasksCount: 0,
	focusMinutes: 0,
	breakMinutes: 0,
	sessionCount: 0,
	avgSessionMinutes: 0,
	hourBuckets: Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		focusMinutes: 0,
	})),
	workTypeStats: [],
	taskCompletionStat: { done: 0, partial: 0, undone: 0 },
};

const statsWithData: DayStats = {
	tasksWithFocusCount: 2,
	doneTasksCount: 1,
	focusMinutes: 75,
	breakMinutes: 10,
	sessionCount: 3,
	avgSessionMinutes: 25,
	hourBuckets: Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		focusMinutes: i === 10 ? 50 : i === 14 ? 25 : 0,
	})),
	workTypeStats: [
		{ workType: "DEEP_WORK", focusMinutes: 50, sessionCount: 2 },
		{ workType: "OPERATIONAL", focusMinutes: 25, sessionCount: 1 },
	],
	taskCompletionStat: { done: 1, partial: 1, undone: 3 },
};

const completedRow: RecapTaskRow = {
	taskId: 1,
	title: "Ship feature",
	firstStartedAt: new Date("2026-06-20T10:00:00Z"),
	lastEndedAt: new Date("2026-06-20T10:25:00Z"),
	focusedMinutes: 25,
	workType: "DEEP_WORK",
	effortMinutes: 30,
	isCompleted: true,
};

const inProgressRow: RecapTaskRow = {
	taskId: 2,
	title: "Review inbox",
	firstStartedAt: new Date("2026-06-20T11:00:00Z"),
	lastEndedAt: new Date("2026-06-20T11:15:00Z"),
	focusedMinutes: 15,
	workType: "OPERATIONAL",
	effortMinutes: 20,
	isCompleted: false,
};

describe("PodsumowanieView", () => {
	it("renders guest empty state", () => {
		render(<PodsumowanieView isGuest stats={null} />);
		expect(screen.getByTestId("podsumowanie-guest-empty")).toBeTruthy();
	});

	it("renders loading state", () => {
		render(<PodsumowanieView isLoading stats={null} />);
		expect(screen.getByTestId("podsumowanie-loading")).toBeTruthy();
	});

	it("renders no-data state when all zeros", () => {
		render(<PodsumowanieView stats={emptyStats} />);
		expect(screen.getByTestId("podsumowanie-no-data")).toBeTruthy();
	});

	it("renders KPI cards when data is present", () => {
		render(<PodsumowanieView stats={statsWithData} />);
		expect(screen.getByTestId("podsumowanie-kpis")).toBeTruthy();
	});

	it("renders hourly chart when data is present", () => {
		render(<PodsumowanieView stats={statsWithData} />);
		expect(screen.getByTestId("podsumowanie-hourly-chart")).toBeTruthy();
	});

	it("renders session-type donut", () => {
		render(<PodsumowanieView stats={statsWithData} />);
		expect(screen.getByTestId("podsumowanie-session-type-donut")).toBeTruthy();
	});

	it("renders task donut", () => {
		render(<PodsumowanieView stats={statsWithData} />);
		expect(screen.getByTestId("podsumowanie-task-donut")).toBeTruthy();
	});

	it("always renders deferred placeholders", () => {
		render(<PodsumowanieView stats={statsWithData} />);
		expect(screen.getByTestId("podsumowanie-deferred")).toBeTruthy();
		expect(screen.getByTestId("podsumowanie-best-time-preview")).toBeTruthy();
		expect(screen.getByTestId("podsumowanie-date-nav-preview")).toBeTruthy();
	});

	it("renders motivational footer banner", () => {
		render(<PodsumowanieView stats={statsWithData} />);
		const hero = screen.getByTestId("podsumowanie-footer-hero");
		expect(hero.textContent).toContain("Good that you showed up");
		expect(hero.getAttribute("aria-hidden")).toBeNull();
	});

	it("renders completed tasks list with type and time badges", () => {
		render(
			<PodsumowanieView
				last24Hours={[completedRow, inProgressRow]}
				stats={statsWithData}
			/>,
		);
		expect(screen.getByTestId("podsumowanie-completed-list")).toBeTruthy();
		expect(screen.getByTestId("podsumowanie-completed-row-1")).toBeTruthy();
		expect(screen.queryByTestId("podsumowanie-completed-row-2")).toBeNull();
		expect(screen.getAllByTestId("completed-task-type-badge")).toHaveLength(1);
		expect(screen.getAllByTestId("completed-task-time-badge")).toHaveLength(1);
	});

	it("renders calm empty state when no completed tasks in recap", () => {
		render(
			<PodsumowanieView last24Hours={[inProgressRow]} stats={statsWithData} />,
		);
		expect(screen.getByTestId("podsumowanie-completed-empty")).toBeTruthy();
	});
});
