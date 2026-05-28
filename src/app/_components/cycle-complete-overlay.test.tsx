import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CycleCompleteOverlay } from "./cycle-complete-overlay";

describe("CycleCompleteOverlay", () => {
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
});
