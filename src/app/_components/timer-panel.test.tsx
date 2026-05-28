import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimerPanel } from "./timer-panel";

describe("TimerPanel", () => {
	it("renders idle duration picker when task is focused", () => {
		render(
			<TimerPanel
				focusedTask={{ id: 1, title: "Write docs" }}
				onInterrupt={vi.fn()}
				onStart={vi.fn().mockResolvedValue(undefined)}
				remainingMs={0}
				state="idle"
			/>,
		);

		expect(screen.getByTestId("timer-panel-idle")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Start Cycle" })).toBeTruthy();
	});

	it("renders countdown when running", () => {
		render(
			<TimerPanel
				focusedTask={{ id: 1, title: "Write docs" }}
				onInterrupt={vi.fn()}
				onStart={vi.fn()}
				remainingMs={125_000}
				state="running"
			/>,
		);

		expect(screen.getByTestId("timer-panel-running")).toBeTruthy();
		expect(screen.getByTestId("timer-countdown").textContent).toBe("02:05");
	});
});
