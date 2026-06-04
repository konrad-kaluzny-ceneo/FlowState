import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimerPanel } from "./timer-panel";

const defaultProps = {
	focusedTask: { id: 1, title: "Write docs" },
	onInterrupt: vi.fn(),
	onStart: vi.fn().mockResolvedValue(undefined),
	remainingMs: 0,
	state: "idle" as const,
};

describe("TimerPanel", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
	});

	it("renders idle duration picker when task is focused", () => {
		render(<TimerPanel {...defaultProps} />);

		expect(screen.getByTestId("timer-panel-idle")).toBeTruthy();
		expect(screen.getByTestId("work-duration-custom-sec")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Start Cycle" })).toBeTruthy();
	});

	it("renders countdown when running", () => {
		render(
			<TimerPanel {...defaultProps} remainingMs={125_000} state="running" />,
		);

		expect(screen.getByTestId("timer-panel-running")).toBeTruthy();
		expect(screen.getByTestId("timer-countdown").textContent).toBe("02:05");
	});

	it("shows error for custom duration below minimum", () => {
		render(<TimerPanel {...defaultProps} />);

		const input = screen.getByTestId("work-duration-custom-sec");
		fireEvent.change(input, { target: { value: "0" } });

		expect(screen.getByText(/Must be between 1 and 5400 seconds/)).toBeTruthy();
		expect(
			(screen.getByRole("button", { name: "Start Cycle" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});

	it("shows error for custom duration above maximum", () => {
		render(<TimerPanel {...defaultProps} />);

		const input = screen.getByTestId("work-duration-custom-sec");
		fireEvent.change(input, { target: { value: "5401" } });

		expect(screen.getByText(/Must be between 1 and 5400 seconds/)).toBeTruthy();
		expect(
			(screen.getByRole("button", { name: "Start Cycle" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});

	it("starts cycle with custom seconds", () => {
		const onStart = vi.fn().mockResolvedValue(undefined);
		render(<TimerPanel {...defaultProps} onStart={onStart} />);

		fireEvent.change(screen.getByTestId("work-duration-custom-sec"), {
			target: { value: "90" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Start Cycle" }));

		expect(onStart).toHaveBeenCalledWith(90);
	});

	it("starts cycle with preset duration", () => {
		const onStart = vi.fn().mockResolvedValue(undefined);
		render(<TimerPanel {...defaultProps} onStart={onStart} />);

		fireEvent.click(screen.getByRole("button", { name: "15 min" }));
		fireEvent.click(screen.getByRole("button", { name: "Start Cycle" }));

		expect(onStart).toHaveBeenCalledWith(15 * 60);
	});
});
