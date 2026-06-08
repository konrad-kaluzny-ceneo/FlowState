import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatchUpState } from "~/lib/catch-up/types";

import { TabReturnCatchUp } from "./tab-return-catchup";

const ENDED_AT_MS = 1_700_000_000_000;
const NOW_MS = ENDED_AT_MS + 120_000;

function makeCatchUp(
	gate: NonNullable<CatchUpState>["gate"],
): NonNullable<CatchUpState> {
	return {
		endedWhileHidden: true,
		cycleEndedAtMs: ENDED_AT_MS,
		gate,
	};
}

describe("TabReturnCatchUp", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW_MS);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders testid, task title, and ended-ago for work confirm", () => {
		render(
			<TabReturnCatchUp
				catchUp={makeCatchUp("WORK_CONFIRM")}
				cycleKind="WORK"
				taskTitle="Write tests"
			/>,
		);

		expect(screen.getByTestId("tab-return-catchup")).toBeTruthy();
		expect(screen.getByText(/Write tests/)).toBeTruthy();
		expect(screen.getByText(/2 minutes ago/)).toBeTruthy();
	});

	it("renders break-specific copy for break confirm", () => {
		render(
			<TabReturnCatchUp
				catchUp={makeCatchUp("BREAK_CONFIRM")}
				cycleKind="SHORT_BREAK"
			/>,
		);

		expect(
			screen.getByText(/Short break finished while you were away/),
		).toBeTruthy();
		expect(screen.getByText(/2 minutes ago/)).toBeTruthy();
	});

	it("renders check-in next-action copy", () => {
		render(<TabReturnCatchUp catchUp={makeCatchUp("CHECK_IN")} />);

		expect(screen.getByText(/energy check-in/i)).toBeTruthy();
	});

	it("renders suggestion next-action copy", () => {
		render(<TabReturnCatchUp catchUp={makeCatchUp("SUGGESTION_ACCEPT")} />);

		expect(screen.getByText(/suggested next task/i)).toBeTruthy();
	});
});
