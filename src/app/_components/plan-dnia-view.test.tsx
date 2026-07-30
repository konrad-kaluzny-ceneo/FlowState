import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useDayPlan } from "~/hooks/use-day-plan";
import type { useDelegationSuggestion } from "~/hooks/use-delegation-suggestion";
import { IntlTestWrapper } from "~/i18n/test-intl";

import { PlanDniaView } from "./plan-dnia-view";

type DayPlan = ReturnType<typeof useDayPlan>;
type DelegationSuggestion = ReturnType<typeof useDelegationSuggestion>;

const delegationSuggestionMock = vi.fn<() => DelegationSuggestion>();
const updateTaskMock = vi.fn().mockResolvedValue(undefined);

vi.mock("~/hooks/use-delegation-suggestion", () => ({
	useDelegationSuggestion: () => delegationSuggestionMock(),
}));

vi.mock("~/hooks/use-task-mutations", () => ({
	useTaskMutations: () => ({
		updateTask: updateTaskMock,
	}),
}));

function makeDelegationSuggestion(
	overrides: Partial<DelegationSuggestion> = {},
): DelegationSuggestion {
	return {
		localDateKey: "2026-07-05",
		status: "empty",
		candidate: null,
		rationale: null,
		skip: vi.fn().mockResolvedValue(undefined),
		isSkipping: false,
		...overrides,
	};
}

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
	beforeEach(() => {
		delegationSuggestionMock.mockReset();
		delegationSuggestionMock.mockReturnValue(makeDelegationSuggestion());
		updateTaskMock.mockClear();
	});

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

	it("shows the delegation suggestion card with a ready candidate", () => {
		delegationSuggestionMock.mockReturnValue(
			makeDelegationSuggestion({
				status: "ready",
				candidate: { id: 7, title: "File expense report" } as never,
				rationale: "Operational work — a good fit to hand off",
			}),
		);

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

		expect(screen.getByTestId("delegation-suggestion-card")).toBeTruthy();
		expect(screen.getByTestId("delegation-task-title").textContent).toBe(
			"File expense report",
		);
	});

	it("accepting the delegation suggestion calls updateTask with status delegated", () => {
		delegationSuggestionMock.mockReturnValue(
			makeDelegationSuggestion({
				status: "ready",
				candidate: { id: 7, title: "File expense report" } as never,
				rationale: "Operational work — a good fit to hand off",
			}),
		);

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

		fireEvent.click(screen.getByTestId("delegation-accept-btn"));

		expect(updateTaskMock).toHaveBeenCalledWith({
			id: 7,
			status: "delegated",
		});
	});

	it("shows nothing for guest mode (no day plan)", () => {
		renderView(<PlanDniaView dayPlan={undefined} />);

		expect(screen.queryByTestId("delegation-suggestion-card")).toBeNull();
		expect(delegationSuggestionMock).not.toHaveBeenCalled();
	});

	it("shows nothing for the delegation card while the day plan is loading", () => {
		renderView(<PlanDniaView dayPlan={makeDayPlan({ isLoading: true })} />);

		expect(screen.queryByTestId("delegation-suggestion-card")).toBeNull();
		expect(delegationSuggestionMock).not.toHaveBeenCalled();
	});
});
