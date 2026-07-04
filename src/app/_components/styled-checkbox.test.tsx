import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StyledCheckbox } from "./styled-checkbox";

describe("StyledCheckbox", () => {
	it("uses useId when id prop is omitted and never copies data-testid to id", () => {
		render(
			<StyledCheckbox
				checked={false}
				data-testid="shared-toggle"
				label="Option A"
				onChange={vi.fn()}
			/>,
		);

		const input = screen.getByTestId("shared-toggle") as HTMLInputElement;
		expect(input.id).toBeTruthy();
		expect(input.id).not.toBe("shared-toggle");
	});

	it("assigns different ids when two instances share the same data-testid", () => {
		render(
			<>
				<StyledCheckbox
					checked={false}
					data-testid="shared-toggle"
					label="Option A"
					onChange={vi.fn()}
				/>
				<StyledCheckbox
					checked
					data-testid="shared-toggle"
					label="Option B"
					onChange={vi.fn()}
				/>
			</>,
		);

		const inputs = screen.getAllByTestId("shared-toggle") as HTMLInputElement[];
		expect(inputs).toHaveLength(2);
		expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
	});

	it("forwards explicit id to input and label htmlFor", () => {
		render(
			<StyledCheckbox
				checked={false}
				data-testid="shared-toggle"
				id="explicit-id"
				label="Option A"
				onChange={vi.fn()}
			/>,
		);

		const input = screen.getByTestId("shared-toggle") as HTMLInputElement;
		expect(input.id).toBe("explicit-id");
		const label = input.closest("label");
		expect(label?.htmlFor).toBe("explicit-id");
	});

	it("toggles via label click when id is explicit", () => {
		const onChange = vi.fn();
		render(
			<StyledCheckbox
				checked={false}
				data-testid="shared-toggle"
				id="explicit-id"
				label="Option A"
				onChange={onChange}
			/>,
		);

		fireEvent.click(screen.getByText("Option A"));
		expect(onChange).toHaveBeenCalledWith(true);
	});
});
