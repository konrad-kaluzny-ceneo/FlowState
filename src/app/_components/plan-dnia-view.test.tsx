import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { useDayPlan } from "~/hooks/use-day-plan";
import { IntlTestWrapper } from "~/i18n/test-intl";

import { PlanDniaView } from "./plan-dnia-view";

type DayPlan = ReturnType<typeof useDayPlan>;

function makeDayPlan(overrides: Partial<DayPlan> = {}): DayPlan {
	return {
		localDateKey: "2026-07-05",
		budgetMinutes: null,
		remainingMinutes: null,
		usedMinutes: 0,
		hasBudget: false,
		energy: null,
		isLoading: false,
		isSettingBudget: false,
		isSettingEnergy: false,
		setBudget: vi.fn().mockResolvedValue(undefined),
		setEnergy: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function renderView(ui: ReactElement) {
	return render(<IntlTestWrapper>{ui}</IntlTestWrapper>);
}

describe("PlanDniaView", () => {
	it("shows a guest empty state when there is no day plan", () => {
		renderView(<PlanDniaView dayPlan={undefined} />);

		expect(screen.getByTestId("plan-dnia-guest-empty")).toBeTruthy();
	});

	it("shows the set-budget prompt when no budget is set", () => {
		renderView(<PlanDniaView dayPlan={makeDayPlan()} />);

		expect(screen.getByTestId("focus-budget-prompt")).toBeTruthy();
		expect(screen.queryByTestId("plan-dnia-summary")).toBeNull();
	});

	it("shows the budget summary when a budget is set", () => {
		renderView(
			<PlanDniaView
				dayPlan={makeDayPlan({
					hasBudget: true,
					budgetMinutes: 240,
					usedMinutes: 60,
					remainingMinutes: 180,
				})}
			/>,
		);

		const summary = screen.getByTestId("plan-dnia-summary");
		expect(summary).toBeTruthy();
		expect(screen.getByTestId("plan-dnia-change-btn")).toBeTruthy();
	});

	it("shows the blurred calendar coming-soon preview", () => {
		renderView(<PlanDniaView dayPlan={makeDayPlan()} />);

		expect(screen.getByTestId("plan-dnia-calendar-preview")).toBeTruthy();
		expect(screen.getByText("Calendar coming soon")).toBeTruthy();
		expect(
			screen
				.getByTestId("plan-dnia-calendar-preview-mock")
				.getAttribute("aria-hidden"),
		).toBe("true");
	});

	it("lets the user change an already-set budget", async () => {
		const setBudget = vi.fn().mockResolvedValue(undefined);
		renderView(
			<PlanDniaView
				dayPlan={makeDayPlan({
					hasBudget: true,
					budgetMinutes: 240,
					usedMinutes: 60,
					remainingMinutes: 180,
					setBudget,
				})}
			/>,
		);

		fireEvent.click(screen.getByTestId("plan-dnia-change-btn"));
		expect(screen.getByTestId("plan-dnia-editor")).toBeTruthy();

		fireEvent.click(screen.getByTestId("plan-dnia-preset-360"));

		await screen.findByTestId("plan-dnia-change-btn");
		expect(setBudget).toHaveBeenCalledWith(360);
	});
});
