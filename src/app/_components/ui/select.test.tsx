import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Select } from "./select";

const OPTIONS = [
	{ value: "newest", label: "Najnowsze" },
	{ value: "priority", label: "Priorytet" },
	{ value: "effort", label: "Nakład pracy" },
];

function ControlledSelect() {
	const [value, setValue] =
		useState<(typeof OPTIONS)[number]["value"]>("newest");
	return (
		<Select
			aria-label="Sortuj"
			onChange={setValue}
			options={OPTIONS}
			value={value}
		/>
	);
}

describe("Select", () => {
	it("shows the selected option label on the trigger", () => {
		render(<ControlledSelect />);
		expect(
			screen.getByRole("button", { name: "Sortuj" }).textContent,
		).toContain("Najnowsze");
	});

	it("opens the listbox on click and lists all options", () => {
		render(<ControlledSelect />);
		fireEvent.click(screen.getByRole("button", { name: "Sortuj" }));

		expect(screen.getByRole("listbox")).toBeTruthy();
		expect(screen.getAllByRole("option")).toHaveLength(3);
	});

	it("selects an option on click and closes the popover", async () => {
		render(<ControlledSelect />);
		fireEvent.click(screen.getByRole("button", { name: "Sortuj" }));
		fireEvent.click(screen.getByRole("option", { name: "Priorytet" }));

		await waitFor(() => {
			expect(screen.queryByRole("listbox")).toBeNull();
		});
		expect(
			screen.getByRole("button", { name: "Sortuj" }).textContent,
		).toContain("Priorytet");
	});

	it("closes on Escape and returns focus to the trigger", async () => {
		render(<ControlledSelect />);
		const trigger = screen.getByRole("button", { name: "Sortuj" });
		fireEvent.click(trigger);

		const listbox = screen.getByRole("listbox");
		fireEvent.keyDown(listbox, { key: "Escape" });

		await waitFor(() => {
			expect(screen.queryByRole("listbox")).toBeNull();
		});
	});

	it("opens the popover with ArrowDown from the trigger", () => {
		render(<ControlledSelect />);
		fireEvent.keyDown(screen.getByRole("button", { name: "Sortuj" }), {
			key: "ArrowDown",
		});

		expect(screen.getByRole("listbox")).toBeTruthy();
	});
});
