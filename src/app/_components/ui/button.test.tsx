import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
	it("renders primary variant by default and fires onClick", () => {
		const onClick = vi.fn();
		render(<Button onClick={onClick}>Save</Button>);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button.className).toContain("bg-accent-cta");

		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("applies the danger variant classes", () => {
		render(<Button variant="danger">Delete</Button>);
		const button = screen.getByRole("button", { name: "Delete" });
		expect(button.className).toContain("bg-danger");
	});

	it("applies the secondary variant classes", () => {
		render(<Button variant="secondary">Cancel</Button>);
		const button = screen.getByRole("button", { name: "Cancel" });
		expect(button.className).toContain("border-border-subtle");
	});

	it("does not fire onClick when disabled", () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Save
			</Button>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(onClick).not.toHaveBeenCalled();
	});

	it("defaults to type=button so it never submits a form", () => {
		render(<Button>Save</Button>);
		expect(
			screen.getByRole("button", { name: "Save" }).getAttribute("type"),
		).toBe("button");
	});
});
