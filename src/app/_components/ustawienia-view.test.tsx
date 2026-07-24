import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntlTestWrapper } from "~/i18n/test-intl";
import messages from "../../../messages/en.json";

import { ThemeProvider } from "./theme-provider";
import { UstawieniaView } from "./ustawienia-view";

const mockSetEnergy = vi.fn().mockResolvedValue(undefined);

vi.mock("~/hooks/use-day-energy", () => ({
	useDayEnergy: vi.fn(() => ({
		energy: "STEADY" as const,
		setEnergy: mockSetEnergy,
		isSaving: false,
		isLoading: false,
	})),
}));

vi.mock("~/hooks/use-language-preference", () => ({
	useLanguagePreference: vi.fn(() => ({
		locale: "en" as const,
		setLocale: vi.fn(),
		isPending: false,
	})),
}));

vi.mock("~/hooks/use-out-of-tab-break-alerts-preference", () => ({
	useOutOfTabBreakAlertsPreference: vi.fn(() => ({
		enabled: false,
		setEnabled: vi.fn(),
	})),
}));

vi.mock("~/hooks/use-cycle-end-audio-preference", () => ({
	useCycleEndAudioPreference: vi.fn(() => ({
		mode: "chime" as const,
		setMode: vi.fn(),
	})),
}));

const mockToggleTip = vi.fn();
const mockDismissNudge = vi.fn();
const mockUseWorkspaceSetupChecklist = vi.fn(() => ({
	doneTipIds: [] as string[],
	nudgeDismissed: false,
	toggleTip: mockToggleTip,
	dismissNudge: mockDismissNudge,
}));

vi.mock("~/hooks/use-workspace-setup-checklist", () => ({
	useWorkspaceSetupChecklist: () => mockUseWorkspaceSetupChecklist(),
}));

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	getNotificationPermission: () => "default" as NotificationPermission,
	requestNotificationPermission: async () =>
		"granted" as NotificationPermission,
}));

function renderView(ui: ReactElement) {
	return render(
		<IntlTestWrapper>
			<ThemeProvider>{ui}</ThemeProvider>
		</IntlTestWrapper>,
	);
}

describe("UstawieniaView", () => {
	beforeEach(() => {
		mockSetEnergy.mockClear();
		mockToggleTip.mockClear();
		mockDismissNudge.mockClear();
		mockUseWorkspaceSetupChecklist.mockReturnValue({
			doneTipIds: [],
			nudgeDismissed: false,
			toggleTip: mockToggleTip,
			dismissNudge: mockDismissNudge,
		});
	});

	it("renders sidebar tabs and default general panel", () => {
		renderView(
			<UstawieniaView
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			/>,
		);

		expect(screen.getByTestId("settings-nav")).toBeTruthy();
		expect(screen.getByTestId("settings-tab-general")).toBeTruthy();
		expect(screen.getByTestId("settings-tab-focus")).toBeTruthy();
		expect(screen.getByTestId("settings-tab-workspace")).toBeTruthy();
		expect(screen.getByTestId("settings-tab-integrations")).toBeTruthy();
		expect(screen.getByTestId("settings-panel-general")).toBeTruthy();
		expect(screen.getByText(messages.Settings.subtitle)).toBeTruthy();
	});

	it("switches to focus sessions panel when tab is clicked", () => {
		renderView(
			<UstawieniaView
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			/>,
		);

		fireEvent.click(screen.getByTestId("settings-tab-focus"));

		expect(screen.getByTestId("settings-panel-focus")).toBeTruthy();
		expect(screen.getByTestId("settings-work-duration-min")).toBeTruthy();
	});

	it("shows day energy section for authenticated users and saves selection", () => {
		renderView(
			<UstawieniaView
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			/>,
		);

		fireEvent.click(screen.getByTestId("settings-tab-energy"));

		expect(screen.getByTestId("settings-day-energy-section")).toBeTruthy();
		fireEvent.click(screen.getByTestId("check-in-energy-focused"));

		expect(mockSetEnergy).toHaveBeenCalledWith("FOCUSED");
	});

	it("hides day energy tab for guest scope", () => {
		renderView(<UstawieniaView scope={{ mode: "guest" }} userName={null} />);

		expect(screen.queryByTestId("settings-tab-energy")).toBeNull();
	});

	it("shows workspace tab for guest and auth and renders checklist", () => {
		renderView(<UstawieniaView scope={{ mode: "guest" }} userName={null} />);

		expect(screen.getByTestId("settings-tab-workspace")).toBeTruthy();
		fireEvent.click(screen.getByTestId("settings-tab-workspace"));
		expect(screen.getByTestId("settings-workspace-section")).toBeTruthy();
		expect(screen.getByTestId("workspace-tip-cursor-agents")).toBeTruthy();
	});

	it("shows workspace nudge after hydrate and dismisses it", () => {
		renderView(
			<UstawieniaView
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			/>,
		);

		expect(screen.getByTestId("settings-workspace-nudge")).toBeTruthy();
		fireEvent.click(screen.getByTestId("settings-workspace-nudge-action"));
		expect(screen.getByTestId("settings-workspace-section")).toBeTruthy();

		fireEvent.click(screen.getByTestId("settings-workspace-nudge-dismiss"));
		expect(mockDismissNudge).toHaveBeenCalledTimes(1);
	});

	it("hides workspace nudge when already dismissed", () => {
		mockUseWorkspaceSetupChecklist.mockReturnValue({
			doneTipIds: [],
			nudgeDismissed: true,
			toggleTip: mockToggleTip,
			dismissNudge: mockDismissNudge,
		});

		renderView(
			<UstawieniaView
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			/>,
		);

		expect(screen.queryByTestId("settings-workspace-nudge")).toBeNull();
	});

	it("keeps nudge hidden before checklist hook hydrates", () => {
		mockUseWorkspaceSetupChecklist.mockReturnValue({
			doneTipIds: [],
			nudgeDismissed: true,
			toggleTip: mockToggleTip,
			dismissNudge: mockDismissNudge,
		});

		renderView(<UstawieniaView scope={{ mode: "guest" }} userName={null} />);

		expect(screen.queryByTestId("settings-workspace-nudge")).toBeNull();
	});

	it("renders MCP coming soon preview on integrations tab", () => {
		renderView(
			<UstawieniaView
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			/>,
		);

		fireEvent.click(screen.getByTestId("settings-tab-integrations"));

		expect(screen.getByTestId("settings-integrations-section")).toBeTruthy();
		expect(screen.getByTestId("settings-mcp-preview")).toBeTruthy();
		expect(screen.getByText(messages.Settings.mcpComingSoon)).toBeTruthy();
	});
});
