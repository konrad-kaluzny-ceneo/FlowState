import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReturnHandoffBanner } from "./return-handoff-banner";

describe("ReturnHandoffBanner", () => {
	it("renders handoff line and dismiss control when visible", () => {
		const onDismiss = vi.fn();
		render(
			<ReturnHandoffBanner
				line="Left off: Wire banner · Session complete — 1 cycle."
				onDismiss={onDismiss}
				visible
			/>,
		);

		expect(screen.getByTestId("return-handoff-banner")).toBeTruthy();
		expect(screen.getByTestId("return-handoff-line").textContent).toBe(
			"Left off: Wire banner · Session complete — 1 cycle.",
		);

		fireEvent.click(screen.getByTestId("return-handoff-dismiss-btn"));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("renders nothing when not visible", () => {
		render(
			<ReturnHandoffBanner line="Hidden" onDismiss={vi.fn()} visible={false} />,
		);

		expect(screen.queryByTestId("return-handoff-banner")).toBeNull();
	});
});
