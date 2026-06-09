import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MidCycleCompletionPrompt } from "./mid-cycle-completion-prompt";

const otherTasks = [
	{
		id: 2,
		title: "Second task",
		status: "active",
		userId: "user-1",
		createdAt: new Date(),
		updatedAt: null,
		workType: "OPERATIONAL" as const,
		weight: 2 as const,
		sortOrder: 0,
	},
];

describe("MidCycleCompletionPrompt", () => {
	it("renders both-choice layout when other active tasks exist", () => {
		render(
			<MidCycleCompletionPrompt
				onContinueWithTask={vi.fn().mockResolvedValue(undefined)}
				onEndCycleAndBreak={vi.fn().mockResolvedValue(undefined)}
				otherActiveTasks={otherTasks}
				pendingTask={{ id: 1, title: "First task" }}
			/>,
		);

		expect(screen.getByTestId("mid-cycle-prompt-overlay")).toBeTruthy();
		expect(screen.getByTestId("mid-cycle-continue-btn")).toBeTruthy();
		expect(screen.getByTestId("mid-cycle-end-break-btn")).toBeTruthy();
	});

	it("renders end-break only when no other active tasks", () => {
		render(
			<MidCycleCompletionPrompt
				onContinueWithTask={vi.fn().mockResolvedValue(undefined)}
				onEndCycleAndBreak={vi.fn().mockResolvedValue(undefined)}
				otherActiveTasks={[]}
				pendingTask={{ id: 1, title: "Only task" }}
			/>,
		);

		expect(screen.getByTestId("mid-cycle-prompt-overlay")).toBeTruthy();
		expect(screen.queryByTestId("mid-cycle-continue-btn")).toBeNull();
		expect(screen.getByTestId("mid-cycle-end-break-btn")).toBeTruthy();
	});

	it("requires task selection before continue", () => {
		const onContinue = vi.fn().mockResolvedValue(undefined);

		render(
			<MidCycleCompletionPrompt
				onContinueWithTask={onContinue}
				onEndCycleAndBreak={vi.fn().mockResolvedValue(undefined)}
				otherActiveTasks={otherTasks}
				pendingTask={{ id: 1, title: "First task" }}
			/>,
		);

		const continueBtn = screen.getByTestId("mid-cycle-continue-btn");
		expect(continueBtn).toHaveProperty("disabled", true);

		fireEvent.click(screen.getByRole("button", { name: "Second task" }));
		expect(continueBtn).toHaveProperty("disabled", false);

		fireEvent.click(continueBtn);
		expect(onContinue).toHaveBeenCalledWith(2);
	});
});
