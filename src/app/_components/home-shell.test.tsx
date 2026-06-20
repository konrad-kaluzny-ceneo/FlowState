import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeShell } from "./home-shell";

const firstRunOverlayProps = vi.fn();
const mergeUiState = vi.hoisted(() => ({
	mergeSuccessVisible: false,
}));

vi.mock("~/app/_components/guest-banner", () => ({
	GuestBanner: () => <div data-testid="guest-banner" />,
}));

vi.mock("~/app/_components/guest-import-on-mount", () => ({
	GuestImportOnMount: () => <div data-testid="guest-import-on-mount" />,
}));

vi.mock("~/app/_components/pomodoro-dashboard", () => ({
	PomodoroDashboard: () => <div data-testid="pomodoro-dashboard" />,
}));

vi.mock("~/app/_components/first-run-overlay", () => ({
	FirstRunOverlay: (props: {
		mode: string;
		visible: boolean;
		onDismiss: () => void;
	}) => {
		firstRunOverlayProps(props);
		return props.visible ? (
			<div data-testid="first-run-overlay">{props.mode}</div>
		) : null;
	},
}));

vi.mock("~/app/_components/merge-success-overlay", () => ({
	MergeSuccessOverlay: () => null,
}));

vi.mock("~/hooks/use-onboarding-state", () => ({
	OnboardingProvider: ({ children }: { children: React.ReactNode }) => children,
	useOnboarding: () => ({
		isFirstRunVisible: true,
		dismissFirstRun: vi.fn(),
	}),
}));

vi.mock("~/app/_components/guest-merge-ui-context", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("./guest-merge-ui-context")>();
	return {
		...actual,
		useGuestMergeUi: () => ({
			mergeSuccessCopy: mergeUiState.mergeSuccessVisible
				? {
						title: "Saved",
						body: "Imported",
						dismissLabel: "Continue",
					}
				: null,
			mergeSuccessVisible: mergeUiState.mergeSuccessVisible,
			dismissMergeSuccess: vi.fn(),
			showMergeSuccess: vi.fn(),
		}),
	};
});

vi.mock("~/hooks/use-test-id-visible", () => ({
	useTestIdVisible: () => false,
}));

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	DataModeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("HomeShell", () => {
	it("shows guest banner and hides guest import when not authenticated", () => {
		mergeUiState.mergeSuccessVisible = false;
		render(<HomeShell isAuthenticated={false} userId={null} />);

		expect(screen.getByTestId("guest-banner")).toBeTruthy();
		expect(screen.queryByTestId("guest-import-on-mount")).toBeNull();
		expect(screen.getByTestId("pomodoro-dashboard")).toBeTruthy();
	});

	it("mounts guest import and hides guest banner when authenticated", () => {
		mergeUiState.mergeSuccessVisible = false;
		render(<HomeShell isAuthenticated={true} userId="user-1" />);

		expect(screen.queryByTestId("guest-banner")).toBeNull();
		expect(screen.getByTestId("guest-import-on-mount")).toBeTruthy();
		expect(screen.getByTestId("pomodoro-dashboard")).toBeTruthy();
	});

	it("suppresses first-run overlay while merge success is visible", () => {
		mergeUiState.mergeSuccessVisible = true;
		firstRunOverlayProps.mockClear();

		render(<HomeShell isAuthenticated={true} userId="user-1" />);

		expect(firstRunOverlayProps).toHaveBeenCalled();
		const lastCall = firstRunOverlayProps.mock.calls.at(-1)?.[0];
		expect(lastCall?.visible).toBe(false);
	});
});
