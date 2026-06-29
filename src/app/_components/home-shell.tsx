"use client";

import { useTranslations } from "next-intl";

import { FirstRunOverlay } from "~/app/_components/first-run-overlay";
import { GuestBanner } from "~/app/_components/guest-banner";
import { GuestImportOnMount } from "~/app/_components/guest-import-on-mount";
import {
	GuestMergeUiProvider,
	useGuestMergeUi,
} from "~/app/_components/guest-merge-ui-context";
import { MergeSuccessOverlay } from "~/app/_components/merge-success-overlay";
import { PomodoroDashboard } from "~/app/_components/pomodoro-dashboard";
import {
	OnboardingProvider,
	useOnboarding,
} from "~/hooks/use-onboarding-state";
import { useOnlineStatus } from "~/hooks/use-online-status";
import { useTestIdVisible } from "~/hooks/use-test-id-visible";
import { DataModeProvider } from "~/lib/data-mode/data-mode-context";
import { HomeHeroSprig } from "~/lib/design/illustrations/home-hero-sprig";
import type { OnboardingScope } from "~/lib/onboarding/types";

type HomeShellProps = {
	isAuthenticated: boolean;
	userId: string | null;
};

function MergeSuccessOverlayMount() {
	const { mergeSuccessCopy, mergeSuccessVisible, dismissMergeSuccess } =
		useGuestMergeUi();

	if (mergeSuccessCopy == null) {
		return null;
	}

	return (
		<MergeSuccessOverlay
			copy={mergeSuccessCopy}
			onDismiss={dismissMergeSuccess}
			visible={mergeSuccessVisible}
		/>
	);
}

function OfflineBanner() {
	const t = useTranslations("Home");
	const isOnline = useOnlineStatus();

	if (isOnline) {
		return null;
	}

	return (
		<div
			className="w-full max-w-lg rounded-lg border border-energy-steady-border bg-energy-steady-bg/90 px-4 py-2 text-center text-sm text-text-secondary"
			data-testid="offline-banner"
			role="status"
		>
			{t("offlineBanner")}
		</div>
	);
}

function HomeShellContent({
	isAuthenticated,
	userId,
}: {
	isAuthenticated: boolean;
	userId: string | null;
}) {
	const t = useTranslations("Home");
	const mode = isAuthenticated ? "authenticated" : "guest";
	const { isFirstRunVisible, dismissFirstRun } = useOnboarding();
	const { mergeSuccessVisible } = useGuestMergeUi();
	const cycleCompleteVisible = useTestIdVisible("cycle-complete-overlay");

	return (
		<DataModeProvider mode={mode}>
			{isAuthenticated && userId != null && (
				<GuestImportOnMount userId={userId} />
			)}
			<MergeSuccessOverlayMount />
			<FirstRunOverlay
				mode={mode}
				onDismiss={dismissFirstRun}
				visible={
					isFirstRunVisible && !cycleCompleteVisible && !mergeSuccessVisible
				}
			/>
			<main
				className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-shell-top to-shell-bottom text-primary transition-colors duration-300 motion-reduce:transition-none"
				id="home-shell-main"
			>
				<div className="container flex flex-col items-center justify-center gap-8 px-4 py-16 lg:max-w-7xl">
					<OfflineBanner />
					<header className="space-y-2 text-center">
						<HomeHeroSprig />
						<h1 className="font-semibold text-4xl tracking-tight">
							{t("appName")}
						</h1>
						<p
							className="font-medium text-base text-text-primary"
							data-testid="home-purpose-header"
						>
							{t("purposeHeader")}
						</p>
						<p className="text-sm text-text-secondary">{t("tagline")}</p>
					</header>
					{!isAuthenticated && <GuestBanner />}
					<PomodoroDashboard />
				</div>
			</main>
		</DataModeProvider>
	);
}

export function HomeShell({ isAuthenticated, userId }: HomeShellProps) {
	const scope: OnboardingScope = isAuthenticated
		? { mode: "authenticated", userId: userId ?? "" }
		: { mode: "guest" };

	return (
		<OnboardingProvider scope={scope}>
			<GuestMergeUiProvider>
				<HomeShellContent isAuthenticated={isAuthenticated} userId={userId} />
			</GuestMergeUiProvider>
		</OnboardingProvider>
	);
}
