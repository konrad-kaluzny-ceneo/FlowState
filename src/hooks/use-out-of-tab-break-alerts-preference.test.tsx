import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useOutOfTabBreakAlertsPreference } from "./use-out-of-tab-break-alerts-preference";

function PreferenceProbe({ scope }: { scope: { mode: "guest" } }) {
	const { enabled, setEnabled } = useOutOfTabBreakAlertsPreference(scope);

	return (
		<div>
			<span data-testid="enabled">{String(enabled)}</span>
			<button
				data-testid="toggle-off"
				onClick={() => setEnabled(false)}
				type="button"
			>
				Off
			</button>
		</div>
	);
}

describe("useOutOfTabBreakAlertsPreference", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("defaults to enabled and persists toggle changes", () => {
		render(<PreferenceProbe scope={{ mode: "guest" }} />);

		expect(screen.getByTestId("enabled").textContent).toBe("true");

		fireEvent.click(screen.getByTestId("toggle-off"));

		expect(screen.getByTestId("enabled").textContent).toBe("false");
	});
});
