import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DelegationSuggestionCard } from "~/app/_components/delegation-suggestion-card";

describe("DelegationSuggestionCard", () => {
	it("renders loading state", () => {
		render(<DelegationSuggestionCard status="loading" />);

		expect(screen.getByTestId("delegation-suggestion-card")).toBeTruthy();
		expect(screen.getByTestId("delegation-loading")).toBeTruthy();
		expect(screen.getByText("Looking for something to hand off…")).toBeTruthy();
	});

	it("renders empty state", () => {
		render(<DelegationSuggestionCard status="empty" />);

		expect(screen.getByTestId("delegation-empty")).toBeTruthy();
		expect(screen.getByText("Nothing to delegate today.")).toBeTruthy();
	});

	it("renders ready state with task title, rationale, and calls Accept/Skip callbacks", () => {
		const onAccept = vi.fn();
		const onSkip = vi.fn();

		render(
			<DelegationSuggestionCard
				onAccept={onAccept}
				onSkip={onSkip}
				rationale="Operational work — a good fit to hand off"
				status="ready"
				taskTitle="File expense report"
			/>,
		);

		expect(screen.getByTestId("delegation-task-title").textContent).toBe(
			"File expense report",
		);
		expect(
			screen.getByText("Operational work — a good fit to hand off"),
		).toBeTruthy();

		fireEvent.click(screen.getByTestId("delegation-accept-btn"));
		expect(onAccept).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByTestId("delegation-skip-btn"));
		expect(onSkip).toHaveBeenCalledTimes(1);
	});

	it("disables and relabels Accept/Skip while pending", () => {
		render(
			<DelegationSuggestionCard
				isAccepting
				isSkipping
				onAccept={vi.fn()}
				onSkip={vi.fn()}
				rationale="Quick, low-effort task — a good fit to hand off"
				status="ready"
				taskTitle="Reply to email"
			/>,
		);

		const acceptBtn = screen.getByTestId(
			"delegation-accept-btn",
		) as HTMLButtonElement;
		const skipBtn = screen.getByTestId(
			"delegation-skip-btn",
		) as HTMLButtonElement;

		expect(acceptBtn.disabled).toBe(true);
		expect(acceptBtn.textContent).toBe("Delegating…");
		expect(skipBtn.disabled).toBe(true);
		expect(skipBtn.textContent).toBe("Skipping…");
	});
});
