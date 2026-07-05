import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PodsumowanieView } from "~/app/_components/podsumowanie-view";
import type { DayStats } from "~/lib/recap/aggregate-day-stats";

// next-intl is globally mocked by src/test/setup.ts; no wrapper needed.

const emptyStats: DayStats = {
	tasksWithFocusCount: 0,
	doneTasksCount: 0,
	focusMinutes: 0,
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
	});
});
