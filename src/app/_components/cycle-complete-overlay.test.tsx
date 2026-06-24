import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BREAK_REENTRY_FOCUSED } from "~/lib/session/transition-copy";

import { CycleCompleteOverlay } from "./cycle-complete-overlay";

describe("CycleCompleteOverlay", () => {
	it("shows Done for today primary action for daily standing tasks", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Stand-up" }}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				primaryMarksDoneForToday
				state="completed"
			/>,
		);

		expect(screen.getByRole("button", { name: "Done for today" })).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "Done — mark task complete" }),
		).toBeNull();
	});

	it("renders actions when state is completed", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				state="completed"
			/>,
		);

		expect(screen.getByTestId("cycle-complete-overlay")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Done — mark task complete" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Continue later" })).toBeTruthy();
	});

	it("hides when not completed", () => {
		const { container } = render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={vi.fn()}
				state="running"
			/>,
		);

		expect(container.firstChild).toBeNull();
	});

	it("renders energy-keyed reentry copy for break completion", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone={false}
				cycleKind="SHORT_BREAK"
				focusedTask={null}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				reentryCopy={BREAK_REENTRY_FOCUSED}
				state="completed"
			/>,
		);

		expect(screen.getByTestId("break-reentry-copy").textContent).toBe(
			BREAK_REENTRY_FOCUSED,
		);
	});
});
