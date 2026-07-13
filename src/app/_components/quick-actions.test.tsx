import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

	it("does not render Start break when onStartBreak is not provided", () => {
		render(<QuickActions onAddTask={vi.fn()} />);

		expect(screen.queryByTestId("quick-action-start-break")).toBeNull();
	});

	it("renders Start break action when onStartBreak is provided", () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		expect(screen.getByTestId("quick-action-start-break")).toBeTruthy();
	});

	it("opens picker when Start break is clicked", () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		expect(screen.queryByTestId("ad-hoc-break-picker")).toBeNull();

		fireEvent.click(screen.getByTestId("quick-action-start-break"));

		expect(screen.getByTestId("ad-hoc-break-picker")).toBeTruthy();
	});

	it("picker has short/long toggle and confirm button", () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		fireEvent.click(screen.getByTestId("quick-action-start-break"));

		expect(screen.getByTestId("ad-hoc-break-short")).toBeTruthy();
		expect(screen.getByTestId("ad-hoc-break-long")).toBeTruthy();
		expect(screen.getByTestId("ad-hoc-break-confirm")).toBeTruthy();
		expect(screen.getByTestId("ad-hoc-break-cancel")).toBeTruthy();
	});

	it("calls onStartBreak with kind and duration when confirmed", async () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		fireEvent.click(screen.getByTestId("quick-action-start-break"));
		fireEvent.click(screen.getByTestId("ad-hoc-break-confirm"));

		await waitFor(() => {
			expect(onStartBreak).toHaveBeenCalledTimes(1);
		});

		// Default is SHORT_BREAK with default short break duration (5 min = 300s)
		expect(onStartBreak).toHaveBeenCalledWith("SHORT_BREAK", 300);
	});

	it("switches to long break kind", async () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		fireEvent.click(screen.getByTestId("quick-action-start-break"));
		fireEvent.click(screen.getByTestId("ad-hoc-break-long"));
		fireEvent.click(screen.getByTestId("ad-hoc-break-confirm"));

		await waitFor(() => {
			expect(onStartBreak).toHaveBeenCalledTimes(1);
		});

		// LONG_BREAK with default long break duration (15 min = 900s)
		expect(onStartBreak).toHaveBeenCalledWith("LONG_BREAK", 900);
	});

	it("closes picker on cancel", () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		fireEvent.click(screen.getByTestId("quick-action-start-break"));
		expect(screen.getByTestId("ad-hoc-break-picker")).toBeTruthy();

		fireEvent.click(screen.getByTestId("ad-hoc-break-cancel"));
		expect(screen.queryByTestId("ad-hoc-break-picker")).toBeNull();
	});

	it("renders Start break in inline variant", () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(
			<QuickActions
				onAddTask={vi.fn()}
				onStartBreak={onStartBreak}
				variant="inline"
			/>,
		);

		expect(screen.getByTestId("quick-action-start-break")).toBeTruthy();
	});

	it("opens picker in inline variant and calls onStartBreak", async () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(
			<QuickActions
				onAddTask={vi.fn()}
				onStartBreak={onStartBreak}
				variant="inline"
			/>,
		);

		fireEvent.click(screen.getByTestId("quick-action-start-break"));
		expect(screen.getByTestId("ad-hoc-break-picker")).toBeTruthy();

		fireEvent.click(screen.getByTestId("ad-hoc-break-confirm"));

		await waitFor(() => {
			expect(onStartBreak).toHaveBeenCalledTimes(1);
		});

		expect(onStartBreak).toHaveBeenCalledWith("SHORT_BREAK", 300);
	});

	it("picker closes after successful start", async () => {
		const onStartBreak = vi.fn().mockResolvedValue(undefined);
		render(<QuickActions onAddTask={vi.fn()} onStartBreak={onStartBreak} />);

		fireEvent.click(screen.getByTestId("quick-action-start-break"));
		expect(screen.getByTestId("ad-hoc-break-picker")).toBeTruthy();

		fireEvent.click(screen.getByTestId("ad-hoc-break-confirm"));

		await waitFor(() => {
			expect(screen.queryByTestId("ad-hoc-break-picker")).toBeNull();
		});
	});

	it("does not render Start break when onStartBreak not provided in inline variant", () => {
		render(<QuickActions onAddTask={vi.fn()} variant="inline" />);

		expect(screen.queryByTestId("quick-action-start-break")).toBeNull();
	});
});
