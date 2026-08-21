import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { FocusTodayPanel } from "~/app/_components/focus-today-panel";
import { IntlTestWrapper } from "~/i18n/test-intl";

vi.mock("~/app/_components/quick-actions", () => ({
	QuickActions: () => <div data-testid="quick-actions-mock">Quick actions</div>,
}));

function renderPanel(
	props: Partial<ComponentProps<typeof FocusTodayPanel>> = {},
) {
	return render(
		<IntlTestWrapper>
			<FocusTodayPanel
				summary={{
					budgetMinutes: null,
					forceShow: true,
					hasBudget: false,
					isLoading: false,
					remainingMinutes: null,
					sessionsCompleted: 0,
					tasksDone: 0,
					tasksTotal: 0,
					usedMinutes: 0,
				}}
				{...props}
			/>
		</IntlTestWrapper>,
	);
}

describe("FocusTodayPanel", () => {
	it("renders consolidated Today panel with nested section test ids", () => {
		renderPanel();

		expect(screen.getByTestId("focus-today-panel")).toBeTruthy();
		expect(screen.getByTestId("home-focus-summary")).toBeTruthy();
		expect(screen.getByTestId("focus-tip")).toBeTruthy();
		expect(screen.getByTestId("quick-actions-mock")).toBeTruthy();
	});

	it("toggles section aria-expanded when section header is clicked", () => {
		renderPanel();

		const tipContent = screen.getByTestId("focus-tip");
		const tipSection = tipContent.closest("div.border-border-subtle");
		expect(tipSection).toBeTruthy();
		const tipToggle = within(tipSection as HTMLElement).getByRole("button");

		expect(tipToggle.getAttribute("aria-expanded")).toBe("false");

		fireEvent.click(tipToggle);
		expect(tipToggle.getAttribute("aria-expanded")).toBe("true");
	});
});
