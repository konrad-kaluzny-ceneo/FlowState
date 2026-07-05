import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DayStartGate } from "./day-start-gate";

beforeEach(() => {
	sessionStorage.clear();
});

describe("DayStartGate", () => {
	it("renders children while visible and not yet dismissed for the date", () => {
		render(
			<DayStartGate localDateKey="2026-07-05" visible>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);

		expect(screen.getByTestId("gate-content")).toBeTruthy();
	});

	it("renders nothing when not visible", () => {
		render(
			<DayStartGate localDateKey="2026-07-05" visible={false}>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);

		expect(screen.queryByTestId("gate-content")).toBeNull();
	});

	it("dismiss-oracle: never re-opens for the same date once visible transitions to false", () => {
		const { rerender } = render(
			<DayStartGate localDateKey="2026-07-05" visible>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);
		expect(screen.getByTestId("gate-content")).toBeTruthy();

		// Steering completes/skips for the day.
		rerender(
			<DayStartGate localDateKey="2026-07-05" visible={false}>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);
		expect(screen.queryByTestId("gate-content")).toBeNull();

		// A later session the same day re-opens steering upstream (hook sets
		// pending true again) — the gate must NOT trap the user by reopening.
		rerender(
			<DayStartGate localDateKey="2026-07-05" visible>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);
		expect(screen.queryByTestId("gate-content")).toBeNull();
	});

	it("dismiss-oracle: a new date is unaffected by a prior date's dismissal", () => {
		const { rerender } = render(
			<DayStartGate localDateKey="2026-07-05" visible>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);
		rerender(
			<DayStartGate localDateKey="2026-07-05" visible={false}>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);
		expect(screen.queryByTestId("gate-content")).toBeNull();

		rerender(
			<DayStartGate localDateKey="2026-07-06" visible>
				<div data-testid="gate-content">steering</div>
			</DayStartGate>,
		);
		expect(screen.getByTestId("gate-content")).toBeTruthy();
	});
});
