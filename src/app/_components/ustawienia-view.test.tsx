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
