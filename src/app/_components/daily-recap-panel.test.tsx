import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { DailyRecap } from "~/lib/recap/types";
import { recapRow } from "~/test/recap-fixtures";

import { DailyRecapPanel } from "./daily-recap-panel";

const DATE_KEY = "2026-06-20";

const sampleRecap: DailyRecap = {
	last24Hours: [
		recapRow({
			taskId: 1,
			title: "Write recap",
			firstStartedAt: new Date("2026-06-20T10:00:00Z"),
			lastEndedAt: new Date("2026-06-20T10:25:00Z"),
			focusedMinutes: 25,
		}),
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

	function expandRecapSections() {
		fireEvent.click(screen.getByTestId("daily-recap-last24-toggle"));
		fireEvent.click(screen.getByTestId("daily-recap-today-toggle"));
	}

	it("renders last 24h and today rows", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		expect(screen.getByTestId("daily-recap-panel")).toBeTruthy();
		expandRecapSections();
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

	it("uses raised card elevation on the panel root", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		const panel = screen.getByTestId("daily-recap-panel");
		expect(panel.className).toContain("bg-surface-card");
		expect(panel.className).toContain("border-card-border");
		expect(panel.className).toContain("shadow-sm");
	});

	it("shows title only without subtitle copy", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		expect(screen.getByText("Daily recap")).toBeTruthy();
		expect(screen.queryByText(/Light timing for standups/i)).toBeNull();
	});

	it("starts collapsed on first paint with aria-expanded false", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		const last24Toggle = screen.getByTestId("daily-recap-last24-toggle");
		const todayToggle = screen.getByTestId("daily-recap-today-toggle");

		expect(last24Toggle.getAttribute("aria-expanded")).toBe("false");
		expect(todayToggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByTestId("daily-recap-last24")).toBeNull();
		expect(screen.queryByTestId("daily-recap-today")).toBeNull();
	});

	it("collapses sections independently via aria-expanded toggles", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		const last24Toggle = screen.getByTestId("daily-recap-last24-toggle");
		const todayToggle = screen.getByTestId("daily-recap-today-toggle");

		expect(last24Toggle.getAttribute("aria-expanded")).toBe("false");
		expect(todayToggle.getAttribute("aria-expanded")).toBe("false");
		expect(last24Toggle.className).not.toContain("hover:underline");
		expect(todayToggle.className).not.toContain("hover:underline");
		expect(screen.queryByTestId("daily-recap-last24")).toBeNull();
		expect(screen.queryByTestId("daily-recap-today")).toBeNull();

		fireEvent.click(last24Toggle);
		expect(last24Toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByTestId("daily-recap-last24")).toBeTruthy();
		expect(screen.queryByTestId("daily-recap-today")).toBeNull();

		fireEvent.click(todayToggle);
		expect(todayToggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByTestId("daily-recap-today")).toBeTruthy();
	});

	it("dismiss hides panel for the local date key", () => {
		render(<DailyRecapPanel localDateKey={DATE_KEY} recap={sampleRecap} />);

		fireEvent.click(screen.getByTestId("daily-recap-dismiss"));
		expect(screen.queryByTestId("daily-recap-panel")).toBeNull();
		expect(
			sessionStorage.getItem(`flowstate:daily-recap-dismiss:${DATE_KEY}`),
		).toBe("1");
	});

	it("omits Last 24h section when there is no data", () => {
		render(
			<DailyRecapPanel
				localDateKey={DATE_KEY}
				recap={{ last24Hours: [], todayPlan: [], footprints: {} }}
			/>,
		);

		expect(
			screen.queryByText(/No focused work in the last 24 hours/i),
		).toBeNull();
		expect(screen.queryByTestId("daily-recap-last24-toggle")).toBeNull();
		expect(screen.queryByTestId("daily-recap-last24")).toBeNull();
		fireEvent.click(screen.getByTestId("daily-recap-today-toggle"));
		expect(screen.getByText(/Nothing on today's plan yet/i)).toBeTruthy();
	});

	it("returns null while loading", () => {
		render(
			<DailyRecapPanel isLoading localDateKey={DATE_KEY} recap={sampleRecap} />,
		);

		expect(screen.queryByTestId("daily-recap-panel")).toBeNull();
	});
});
