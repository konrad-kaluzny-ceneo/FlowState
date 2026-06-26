import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimerPanel } from "./timer-panel";

const defaultProps = {
	focusedTask: { id: 1, title: "Write docs" },
	onInterrupt: vi.fn().mockResolvedValue(undefined),
	onPause: vi.fn().mockResolvedValue(undefined),
	onResume: vi.fn().mockResolvedValue(undefined),
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
		expect(screen.getByTestId("work-duration-min")).toBeTruthy();
		expect(screen.getByTestId("work-duration-sec")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Start cycle for Write docs" }),
		).toBeTruthy();
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

		fireEvent.change(screen.getByTestId("work-duration-min"), {
			target: { value: "0" },
		});
		fireEvent.change(screen.getByTestId("work-duration-sec"), {
			target: { value: "0" },
		});

		expect(screen.getByText(/Must be within 1 s – 90 min/)).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "Start cycle for Write docs",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
	});

	it("shows error for custom duration above maximum", () => {
		render(<TimerPanel {...defaultProps} />);

		fireEvent.change(screen.getByTestId("work-duration-min"), {
			target: { value: "91" },
		});
		fireEvent.change(screen.getByTestId("work-duration-sec"), {
			target: { value: "0" },
		});

		expect(screen.getByText(/Must be within 1 s – 90 min/)).toBeTruthy();
		expect(
			(
				screen.getByRole("button", {
					name: "Start cycle for Write docs",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
	});

	it("starts cycle with custom seconds", () => {
		const onStart = vi.fn().mockResolvedValue(undefined);
		render(<TimerPanel {...defaultProps} onStart={onStart} />);

		fireEvent.change(screen.getByTestId("work-duration-min"), {
			target: { value: "0" },
		});
		fireEvent.change(screen.getByTestId("work-duration-sec"), {
			target: { value: "90" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Start cycle for Write docs" }),
		);

		expect(onStart).toHaveBeenCalledWith(90);
	});

	it("starts cycle with preset duration", () => {
		const onStart = vi.fn().mockResolvedValue(undefined);
		render(<TimerPanel {...defaultProps} onStart={onStart} />);

		fireEvent.click(screen.getByRole("button", { name: "15 min" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Start cycle for Write docs" }),
		);

		expect(onStart).toHaveBeenCalledWith(15 * 60);
	});

	it("pause and interrupt controls expose accessible names when running", () => {
		render(
			<TimerPanel {...defaultProps} remainingMs={125_000} state="running" />,
		);

		expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Interrupt" })).toBeTruthy();
	});

	it("shows Pause and Interrupt when running", () => {
		render(
			<TimerPanel {...defaultProps} remainingMs={125_000} state="running" />,
		);

		expect(screen.getByTestId("timer-panel-running")).toBeTruthy();
		expect(screen.getByTestId("timer-pause")).toBeTruthy();
		expect(screen.getByTestId("timer-interrupt")).toBeTruthy();
		expect(screen.queryByTestId("timer-resume")).toBeNull();
	});

	it("calls onPause when Pause is clicked", () => {
		const onPause = vi.fn().mockResolvedValue(undefined);
		render(
			<TimerPanel
				{...defaultProps}
				onPause={onPause}
				remainingMs={125_000}
				state="running"
			/>,
		);

		fireEvent.click(screen.getByTestId("timer-pause"));

		expect(onPause).toHaveBeenCalledOnce();
	});

	it("shows Resume and frozen countdown when paused", () => {
		render(
			<TimerPanel {...defaultProps} remainingMs={90_000} state="paused" />,
		);

		expect(screen.getByTestId("timer-panel-paused")).toBeTruthy();
		expect(screen.getByTestId("timer-countdown").textContent).toBe("01:30");
		expect(screen.getByTestId("timer-resume")).toBeTruthy();
		expect(screen.queryByTestId("timer-pause")).toBeNull();
		expect(screen.queryByTestId("timer-interrupt")).toBeNull();
	});

	it("calls onResume when Resume is clicked", () => {
		const onResume = vi.fn().mockResolvedValue(undefined);
		render(
			<TimerPanel
				{...defaultProps}
				onResume={onResume}
				remainingMs={90_000}
				state="paused"
			/>,
		);

		fireEvent.click(screen.getByTestId("timer-resume"));

		expect(onResume).toHaveBeenCalledOnce();
	});

	it("uses break labels on a paused short break", () => {
		render(
			<TimerPanel
				{...defaultProps}
				cycleKind="SHORT_BREAK"
				remainingMs={300_000}
				state="paused"
			/>,
		);

		expect(screen.getByText("Break paused")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Resume break" })).toBeTruthy();
	});

	it("labels idle start with task context and keeps countdown off live regions", () => {
		render(<TimerPanel {...defaultProps} />);

		expect(
			screen.getByRole("button", { name: "Start cycle for Write docs" }),
		).toBeTruthy();
		expect(screen.queryByTestId("timer-countdown")).toBeNull();
		expect(document.querySelector('[aria-live="polite"]')).toBeNull();
	});

	it("does not put the running countdown in a live region", () => {
		render(
			<TimerPanel {...defaultProps} remainingMs={125_000} state="running" />,
		);

		const countdown = screen.getByTestId("timer-countdown");
		expect(countdown.getAttribute("aria-live")).toBeNull();
		expect(screen.getByRole("region", { name: "Focus timer" })).toBeTruthy();
	});
});
