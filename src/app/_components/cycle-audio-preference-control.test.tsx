import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CycleAudioPreferenceControl } from "./cycle-audio-preference-control";

describe("CycleAudioPreferenceControl", () => {
	it("renders cycle end audio toggle with aria-pressed on active mode", () => {
		render(<CycleAudioPreferenceControl mode="normal" onChange={vi.fn()} />);

		expect(screen.getByTestId("cycle-audio-preference")).toBeTruthy();
		expect(screen.getByText("Cycle end audio")).toBeTruthy();

		const normal = screen.getByTestId("cycle-audio-preference-normal");
		const soft = screen.getByTestId("cycle-audio-preference-soft");
		const muted = screen.getByTestId("cycle-audio-preference-muted");

		expect(normal.getAttribute("aria-pressed")).toBe("true");
		expect(soft.getAttribute("aria-pressed")).toBe("false");
		expect(muted.getAttribute("aria-pressed")).toBe("false");
	});

	it("updates aria-pressed and calls onChange when mode button is clicked", () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<CycleAudioPreferenceControl mode="normal" onChange={onChange} />,
		);

		fireEvent.click(screen.getByTestId("cycle-audio-preference-muted"));

		expect(onChange).toHaveBeenCalledWith("muted");

		rerender(<CycleAudioPreferenceControl mode="muted" onChange={onChange} />);

		expect(
			screen
				.getByTestId("cycle-audio-preference-muted")
				.getAttribute("aria-pressed"),
		).toBe("true");
		expect(
			screen
				.getByTestId("cycle-audio-preference-normal")
				.getAttribute("aria-pressed"),
		).toBe("false");
	});
});
