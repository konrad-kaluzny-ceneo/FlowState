"use client";

import { useTranslations } from "next-intl";

import { FirstRunOverlay } from "~/app/_components/first-run-overlay";
import { FocusPageFooter } from "~/app/_components/focus-page-footer";
import { FocusPageHeader } from "~/app/_components/focus-page-header";
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
import { HomeIllustrationVariantProvider } from "~/lib/design/home-illustration-variant";
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
	const t = useTranslations("Navbar");
	const mode = isAuthenticated ? "authenticated" : "guest";
	const { isFirstRunVisible, dismissFirstRun } = useOnboarding();
	const { mergeSuccessVisible } = useGuestMergeUi();
	const cycleCompleteVisible = useTestIdVisible("cycle-complete-overlay");

	return (
		<>
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
				className="flex flex-1 flex-col bg-gradient-to-b from-shell-top to-shell-bottom text-primary transition-colors duration-300 motion-reduce:transition-none"
				id="home-shell-main"
			>
				<div className="container flex w-full flex-1 flex-col gap-6 px-4 py-6 lg:max-w-7xl lg:px-8 lg:py-8">
					<h1 className="sr-only">{t("brand")}</h1>
					<FocusPageHeader />
					<OfflineBanner />
					{!isAuthenticated && <GuestBanner />}
					<PomodoroDashboard />
					<FocusPageFooter />
				</div>
			</main>
		</>
	);
}

export function HomeShell({ isAuthenticated, userId }: HomeShellProps) {
	const scope: OnboardingScope = isAuthenticated
		? { mode: "authenticated", userId: userId ?? "" }
		: { mode: "guest" };

	return (
		<OnboardingProvider scope={scope}>
			<GuestMergeUiProvider>
				<HomeIllustrationVariantProvider>
					<HomeShellContent isAuthenticated={isAuthenticated} userId={userId} />
				</HomeIllustrationVariantProvider>
			</GuestMergeUiProvider>
		</OnboardingProvider>
	);
}
