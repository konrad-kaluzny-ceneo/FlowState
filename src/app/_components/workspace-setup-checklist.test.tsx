import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntlTestWrapper } from "~/i18n/test-intl";
import messages from "../../../messages/en.json";

import { WorkspaceSetupChecklist } from "./workspace-setup-checklist";

describe("WorkspaceSetupChecklist", () => {
	it("renders categorized tips and toggles via checkbox", () => {
		const onToggleTip = vi.fn();

		render(
			<IntlTestWrapper>
				<WorkspaceSetupChecklist
					doneTipIds={["slack-dnd"]}
					onToggleTip={onToggleTip}
				/>
			</IntlTestWrapper>,
		);

		expect(screen.getByTestId("settings-workspace-section")).toBeTruthy();
		expect(
			screen.getByText(messages.WorkspaceSetup.categories.editor),
		).toBeTruthy();
		expect(screen.getByTestId("workspace-tip-cursor-agents")).toBeTruthy();
		expect(
			screen.getByTestId("workspace-tip-slack-dnd").getAttribute("data-done"),
		).toBe("true");

		fireEvent.click(
			screen.getByRole("checkbox", {
				name: messages.WorkspaceSetup.tips["cursor-agents"].title,
			}),
		);

		expect(onToggleTip).toHaveBeenCalledWith("cursor-agents");
	});

	it("renders guide links with safe target attrs and omits missing urls", () => {
		render(
			<IntlTestWrapper>
				<WorkspaceSetupChecklist doneTipIds={[]} onToggleTip={vi.fn()} />
			</IntlTestWrapper>,
		);

		const guide = screen.getByRole("link", {
			name: messages.WorkspaceSetup.tips["cursor-agents"].guideLabel,
		});
		expect(guide.getAttribute("target")).toBe("_blank");
		expect(guide.getAttribute("rel")).toBe("noopener noreferrer");
		expect(guide.getAttribute("href")).toBe(
			messages.WorkspaceSetup.tips["cursor-agents"].guideUrl,
		);

		const emailTip = screen.getByTestId("workspace-tip-email-batching");
		expect(emailTip.querySelector("a")).toBeNull();
	});
});
