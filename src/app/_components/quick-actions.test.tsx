import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickActions } from "./quick-actions";

describe("QuickActions", () => {
	it("renders add task and plan day actions without a view-tasks link", () => {
		render(<QuickActions onAddTask={vi.fn()} />);

		expect(screen.getByTestId("quick-actions")).toBeTruthy();
		expect(screen.getByTestId("quick-action-add-task")).toBeTruthy();
		expect(screen.getByTestId("quick-action-plan-day")).toBeTruthy();
		expect(screen.queryByTestId("quick-action-view-tasks")).toBeNull();
	});

	it("calls onAddTask when add task is clicked", () => {
		const onAddTask = vi.fn();
		render(<QuickActions onAddTask={onAddTask} />);

		fireEvent.click(screen.getByTestId("quick-action-add-task"));

		expect(onAddTask).toHaveBeenCalledTimes(1);
	});

	it("links plan day to /plan", () => {
		render(<QuickActions onAddTask={vi.fn()} />);

		const planLink = screen.getByTestId("quick-action-plan-day");
		expect(planLink.getAttribute("href")).toBe("/plan");
	});
});
