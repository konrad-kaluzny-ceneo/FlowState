import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FocusEmptyState } from "./focus-empty-state";

describe("FocusEmptyState", () => {
	it("renders heading, subtitle, and CTA", () => {
		render(<FocusEmptyState onAddTask={vi.fn()} />);

		expect(screen.getByTestId("focus-empty-state")).toBeTruthy();
		expect(screen.getByText("Your day is waiting for you")).toBeTruthy();
		expect(
			screen.getByText("Add your first task to start a focus session."),
		).toBeTruthy();
		expect(screen.getByTestId("focus-empty-add-task")).toBeTruthy();
	});

	it("calls onAddTask when CTA is clicked", () => {
		const onAddTask = vi.fn();
		render(<FocusEmptyState onAddTask={onAddTask} />);

		fireEvent.click(screen.getByTestId("focus-empty-add-task"));

		expect(onAddTask).toHaveBeenCalledTimes(1);
	});
});
