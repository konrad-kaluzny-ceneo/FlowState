import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KickoffDurationChips } from "./kickoff-duration-chips";

const guestScope = { mode: "guest" as const };

describe("KickoffDurationChips", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("renders preset duration chip and calls onSelect with chip seconds", () => {
		const onSelect = vi.fn();

		render(
			<KickoffDurationChips
				onSelect={onSelect}
				scope={guestScope}
				workType="OPERATIONAL"
			/>,
		);

		expect(screen.getByTestId("kickoff-duration-chips")).toBeTruthy();
		expect(screen.getByText("25 min")).toBeTruthy();

		fireEvent.click(screen.getByTestId("kickoff-duration-chip"));
		expect(onSelect).toHaveBeenCalledWith(25 * 60);
	});

	it("shows your usual label when work type duration is remembered", () => {
		localStorage.setItem(
			"flowstate:workTypeDurationSec",
			JSON.stringify({ OPERATIONAL: 30 * 60 }),
		);

		render(
			<KickoffDurationChips
				onSelect={vi.fn()}
				scope={guestScope}
				workType="OPERATIONAL"
			/>,
		);

		expect(screen.getByText("your usual")).toBeTruthy();
	});
});
