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

	it("renders a full ring when no configured duration is known", () => {
		const { container } = render(
			<TimerPanel {...defaultProps} remainingMs={125_000} state="running" />,
		);

		const progressCircle = container.querySelectorAll("circle")[1];
		expect(progressCircle?.getAttribute("stroke-dashoffset")).toBe(
			progressCircle?.getAttribute("stroke-dasharray"),
		);
	});

	it("fills the ring proportionally to elapsed time", () => {
		const { container } = render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={1000}
				remainingMs={250_000}
				state="running"
			/>,
		);

		const progressCircle = container.querySelectorAll("circle")[1];
		const circumference = Number(
			progressCircle?.getAttribute("stroke-dasharray"),
		);
		const dashOffset = Number(
			progressCircle?.getAttribute("stroke-dashoffset"),
		);

		expect(dashOffset).toBeCloseTo(circumference * 0.25, 5);
	});

	it("keeps the countdown legible with the break ring tint while paused", () => {
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				remainingMs={150_000}
				state="paused"
			/>,
		);

		const progressCircle = document.querySelectorAll("circle")[1];
		expect(progressCircle?.getAttribute("class")).toContain(
			"stroke-accent-break",
		);
	});

	it("renders overtime countdown with + prefix when break remainingMs is negative", () => {
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				onEndBreak={vi.fn().mockResolvedValue(undefined)}
				remainingMs={-65_000}
				state="running"
			/>,
		);

		expect(screen.getByTestId("timer-countdown").textContent).toBe("+01:05");
	});

	it("renders End break button during overtime", () => {
		const onEndBreak = vi.fn().mockResolvedValue(undefined);
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				onEndBreak={onEndBreak}
				remainingMs={-10_000}
				state="running"
			/>,
		);

		expect(screen.getByTestId("timer-end-break")).toBeTruthy();
	});

	it("calls onEndBreak when End break button is clicked", () => {
		const onEndBreak = vi.fn().mockResolvedValue(undefined);
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				onEndBreak={onEndBreak}
				remainingMs={-10_000}
				state="running"
			/>,
		);

		fireEvent.click(screen.getByTestId("timer-end-break"));

		expect(onEndBreak).toHaveBeenCalledOnce();
	});

	it("renders End break button when paused in overtime", () => {
		const onEndBreak = vi.fn().mockResolvedValue(undefined);
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				onEndBreak={onEndBreak}
				remainingMs={-5_000}
				state="paused"
			/>,
		);

		expect(screen.getByTestId("timer-end-break")).toBeTruthy();
	});

	it("does not render End break during normal running (positive remaining)", () => {
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				onEndBreak={vi.fn().mockResolvedValue(undefined)}
				remainingMs={150_000}
				state="running"
			/>,
		);

		expect(screen.queryByTestId("timer-end-break")).toBeNull();
	});

	it("does not render End break for WORK cycles even with negative remaining", () => {
		render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={1500}
				cycleKind={null}
				onEndBreak={vi.fn().mockResolvedValue(undefined)}
				remainingMs={-5_000}
				state="running"
			/>,
		);

		expect(screen.queryByTestId("timer-end-break")).toBeNull();
	});

	it("clamps progress ring at 100% during overtime", () => {
		const { container } = render(
			<TimerPanel
				{...defaultProps}
				configuredDurationSec={300}
				cycleKind="SHORT_BREAK"
				onEndBreak={vi.fn().mockResolvedValue(undefined)}
				remainingMs={-60_000}
				state="running"
			/>,
		);

		const progressCircle = container.querySelectorAll("circle")[1];
		const dashOffset = Number(
			progressCircle?.getAttribute("stroke-dashoffset"),
		);
		// Should be 0 or very close to 0 (fully filled)
		expect(dashOffset).toBeLessThanOrEqual(0.1);
	});
});
