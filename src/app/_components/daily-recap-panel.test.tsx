import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { DailyRecap } from "~/lib/recap/types";

import { DailyRecapPanel } from "./daily-recap-panel";

const DATE_KEY = "2026-06-20";

const sampleRecap: DailyRecap = {
	last24Hours: [
		{
			taskId: 1,
			title: "Write recap",
			firstStartedAt: new Date("2026-06-20T10:00:00Z"),
			lastEndedAt: new Date("2026-06-20T10:25:00Z"),
			focusedMinutes: 25,
		},
	],
	todayPlan: [
		{
			taskId: 2,
			title: "Standing chore",
			isDailyStanding: true,
			doneForToday: false,
			effortMinutes: 15,
		},
	],
	footprints: {},
};

describe("DailyRecapPanel", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("renders last 24h and today rows", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		expect(screen.getByTestId("daily-recap-panel")).toBeTruthy();
		expect(screen.getByTestId("daily-recap-last24").textContent).toContain(
			"Write recap",
		);
		expect(screen.getByTestId("daily-recap-last24").textContent).toContain(
			"25m",
		);
		expect(screen.getByTestId("daily-recap-today").textContent).toContain(
			"Standing chore",
		);
	});

	it("collapses sections independently via aria-expanded toggles", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		const last24Toggle = screen.getByTestId("daily-recap-last24-toggle");
		const todayToggle = screen.getByTestId("daily-recap-today-toggle");

		expect(last24Toggle.getAttribute("aria-expanded")).toBe("true");
		expect(todayToggle.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(last24Toggle);
		expect(last24Toggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByTestId("daily-recap-last24")).toBeNull();
		expect(screen.getByTestId("daily-recap-today")).toBeTruthy();

		fireEvent.click(todayToggle);
		expect(todayToggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByTestId("daily-recap-today")).toBeNull();
	});

	it("dismiss hides panel for the local date key", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		fireEvent.click(screen.getByTestId("daily-recap-dismiss"));
		expect(screen.queryByTestId("daily-recap-panel")).toBeNull();
		expect(
			sessionStorage.getItem(`flowstate:daily-recap-dismiss:${DATE_KEY}`),
		).toBe("1");
	});

	it("shows empty states when sections have no rows", () => {
		render(
			<DailyRecapPanel
				localDateKey={DATE_KEY}
				recap={{ last24Hours: [], todayPlan: [], footprints: {} }}
			/>,
		);

		expect(
			screen.getByText(/No focused work in the last 24 hours/i),
		).toBeTruthy();
		expect(screen.getByText(/Nothing on today's plan yet/i)).toBeTruthy();
	});

	it("returns null while loading", () => {
		render(
			<DailyRecapPanel isLoading localDateKey={DATE_KEY} recap={sampleRecap} />,
		);

		expect(screen.queryByTestId("daily-recap-panel")).toBeNull();
	});
});
