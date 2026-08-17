import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useDayPlan } from "~/hooks/use-day-plan";
import type { useDaySchedule } from "~/hooks/use-day-schedule";
import type { useDelegationSuggestion } from "~/hooks/use-delegation-suggestion";
import { IntlTestWrapper } from "~/i18n/test-intl";

import { PlanDniaView } from "./plan-dnia-view";

type DayPlan = ReturnType<typeof useDayPlan>;
type DaySchedule = ReturnType<typeof useDaySchedule>;
type DelegationSuggestion = ReturnType<typeof useDelegationSuggestion>;

const delegationSuggestionMock = vi.fn<() => DelegationSuggestion>();
const updateTaskMock = vi.fn().mockResolvedValue(undefined);
const invalidateDelegationSuggestionMock = vi.fn().mockResolvedValue(undefined);

vi.mock("~/hooks/use-delegation-suggestion", () => ({
	useDelegationSuggestion: () => delegationSuggestionMock(),
}));

vi.mock("~/hooks/use-task-mutations", () => ({
	useTaskMutations: () => ({
		updateTask: updateTaskMock,
	}),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			dayPlan: {
				getDelegationSuggestion: {
					invalidate: invalidateDelegationSuggestionMock,
				},
			},
		}),
	},
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

function makeDaySchedule(overrides: Partial<DaySchedule> = {}): DaySchedule {
	return {
		blocks: [],
		isLoading: false,
		error: null,
		createBlock: vi.fn().mockResolvedValue(undefined),
		updateBlock: vi.fn().mockResolvedValue(undefined),
		deleteBlock: vi.fn().mockResolvedValue(undefined),
		setBlockFocusTask: vi.fn().mockResolvedValue(undefined),
		setBlockBatchTasks: vi.fn().mockResolvedValue(undefined),
		contextTags: [],
		createContextTag: vi.fn().mockResolvedValue(undefined),
		deleteContextTag: vi.fn().mockResolvedValue(undefined),
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
		invalidateDelegationSuggestionMock.mockClear();
	});

	it("shows a guest empty state when there is no day plan", () => {
		renderView(<PlanDniaView dayPlan={undefined} />);

		expect(screen.getByTestId("plan-dnia-guest-empty")).toBeTruthy();
		expect(screen.queryByTestId("plan-dnia-calendar-preview")).toBeNull();
		expect(screen.queryByTestId("schedule-timeline")).toBeNull();
	});

	it("shows the set-budget prompt when no budget is set", () => {
		renderView(
			<PlanDniaView dayPlan={makeDayPlan()} daySchedule={makeDaySchedule()} />,
		);

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
				daySchedule={makeDaySchedule()}
			/>,
		);

		const summary = screen.getByTestId("plan-dnia-summary");
		expect(summary).toBeTruthy();
		expect(screen.getByTestId("plan-dnia-change-btn")).toBeTruthy();
	});

	it("renders the auth timeline and never the calendar coming-soon preview", () => {
		renderView(
			<PlanDniaView dayPlan={makeDayPlan()} daySchedule={makeDaySchedule()} />,
		);

		expect(screen.getByTestId("schedule-timeline")).toBeTruthy();
		expect(screen.queryByTestId("plan-dnia-calendar-preview")).toBeNull();
		expect(screen.queryByText("Calendar coming soon")).toBeNull();
	});

	it("surfaces an overlap error from the schedule hook", () => {
		renderView(
			<PlanDniaView
				dayPlan={makeDayPlan()}
				daySchedule={makeDaySchedule({
					error: "This block overlaps another — pick a different time.",
				})}
			/>,
		);

		expect(screen.getByRole("alert").textContent).toContain("overlaps");
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
				daySchedule={makeDaySchedule()}
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
				daySchedule={makeDaySchedule()}
			/>,
		);

		expect(screen.getByTestId("delegation-suggestion-card")).toBeTruthy();
		expect(screen.getByTestId("delegation-task-title").textContent).toBe(
			"File expense report",
		);
	});

	it("accepting the delegation suggestion calls updateTask with status delegated", async () => {
		delegationSuggestionMock.mockReturnValue(
			makeDelegationSuggestion({
				localDateKey: "2026-07-05",
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
				daySchedule={makeDaySchedule()}
			/>,
		);

		fireEvent.click(screen.getByTestId("delegation-accept-btn"));

		expect(updateTaskMock).toHaveBeenCalledWith({
			id: 7,
			status: "delegated",
		});

		// Accepting must invalidate the cached suggestion the same way skip
		// already does — otherwise the card keeps showing the just-delegated
		// task as a live "ready" candidate until the query's staleTime lapses.
		await vi.waitFor(() => {
			expect(invalidateDelegationSuggestionMock).toHaveBeenCalledWith({
				localDateKey: "2026-07-05",
			});
		});
	});

	it("shows nothing for guest mode (no day plan)", () => {
		renderView(<PlanDniaView dayPlan={undefined} />);

		expect(screen.queryByTestId("delegation-suggestion-card")).toBeNull();
		expect(delegationSuggestionMock).not.toHaveBeenCalled();
	});

	it("shows nothing for the delegation card while the day plan is loading", () => {
		renderView(
			<PlanDniaView
				dayPlan={makeDayPlan({ isLoading: true })}
				daySchedule={makeDaySchedule({ isLoading: true })}
			/>,
		);

		expect(screen.queryByTestId("delegation-suggestion-card")).toBeNull();
		expect(delegationSuggestionMock).not.toHaveBeenCalled();
	});
});
