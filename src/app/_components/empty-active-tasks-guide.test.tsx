import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyActiveTasksGuide } from "./empty-active-tasks-guide";

describe("EmptyActiveTasksGuide", () => {
	it("renders guest copy and wires add-task click", () => {
		const onAddTaskClick = vi.fn();

		render(
			<EmptyActiveTasksGuide mode="guest" onAddTaskClick={onAddTaskClick} />,
		);

		expect(screen.getByTestId("empty-active-tasks-guide")).toBeTruthy();
		expect(screen.getByText(/Sign in to unlock energy check-ins/)).toBeTruthy();

		fireEvent.click(screen.getByTestId("empty-active-tasks-add-btn"));
		expect(onAddTaskClick).toHaveBeenCalledOnce();
	});

	it("renders signed-in copy without guest upsell", () => {
		render(<EmptyActiveTasksGuide mode="authenticated" />);

		expect(
			screen.getByText("No active tasks yet — add one to start a focus cycle."),
		).toBeTruthy();
		expect(screen.queryByText(/Sign in to unlock energy check-ins/)).toBeNull();
	});
});
