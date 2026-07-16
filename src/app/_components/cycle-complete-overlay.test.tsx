import { fireEvent, render, screen } from "@testing-library/react";
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

	it("renders labelled modal dialog with actions when state is completed", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				state="completed"
			/>,
		);

		const dialog = screen.getByRole("dialog", { name: "Cycle Complete!" });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-describedby")).toBe(
			"cycle-complete-description",
		);
		expect(screen.getByTestId("cycle-complete-overlay")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Done — mark task complete" }),
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Continue later" })).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "Done — mark task complete" }),
		);
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

		expect(screen.getByRole("dialog", { name: "Break's over!" })).toBeTruthy();
		expect(screen.getByTestId("break-reentry-copy").textContent).toBe(
			BREAK_REENTRY_FOCUSED,
		);
	});

	it("dismisses work-cycle gate via Escape using Continue later path", () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={onConfirm}
				state="completed"
			/>,
		);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onConfirm).toHaveBeenCalledWith("keep");
	});

	it("keeps Tab focus inside the work-cycle modal gate", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				state="completed"
			/>,
		);

		const primary = screen.getByRole("button", {
			name: "Done — mark task complete",
		});
		const secondary = screen.getByRole("button", { name: "Continue later" });

		secondary.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
		expect(document.activeElement).toBe(primary);
	});

	it("renders blocked button in work-cycle overlay", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				state="completed"
			/>,
		);

		expect(screen.getByTestId("cycle-complete-blocked-btn")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Blocked — waiting on something" }),
		).toBeTruthy();
	});

	it("fires blocked fate when blocked button is clicked (dismiss-oracle)", () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={onConfirm}
				state="completed"
			/>,
		);

		fireEvent.click(screen.getByTestId("cycle-complete-blocked-btn"));
		expect(onConfirm).toHaveBeenCalledWith("blocked");
	});

	it("fires done fate when primary button is clicked", () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={onConfirm}
				state="completed"
			/>,
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Done — mark task complete" }),
		);
		expect(onConfirm).toHaveBeenCalledWith("done");
	});

	it("fires keep fate when Continue later button is clicked", () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(
			<CycleCompleteOverlay
				canMarkTaskDone
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={onConfirm}
				state="completed"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Continue later" }));
		expect(onConfirm).toHaveBeenCalledWith("keep");
	});

	it("disables blocked button when canMarkTaskDone is false", () => {
		render(
			<CycleCompleteOverlay
				canMarkTaskDone={false}
				focusedTask={{ id: 1, title: "Ship feature" }}
				onConfirm={vi.fn().mockResolvedValue(undefined)}
				state="completed"
			/>,
		);

		const blocked = screen.getByTestId("cycle-complete-blocked-btn");
		expect(blocked).toHaveProperty("disabled", true);
	});
});
