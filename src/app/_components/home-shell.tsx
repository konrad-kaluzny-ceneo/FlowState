"use client";

import { FirstRunOverlay } from "~/app/_components/first-run-overlay";
import { GuestBanner } from "~/app/_components/guest-banner";
import { GuestImportOnMount } from "~/app/_components/guest-import-on-mount";
import { PomodoroDashboard } from "~/app/_components/pomodoro-dashboard";
import {
	OnboardingProvider,
	useOnboarding,
} from "~/hooks/use-onboarding-state";
import { useTestIdVisible } from "~/hooks/use-test-id-visible";
import { DataModeProvider } from "~/lib/data-mode/data-mode-context";
import type { OnboardingScope } from "~/lib/onboarding/types";

type HomeShellProps = {
	isAuthenticated: boolean;
	userId: string | null;
};

function HomeShellContent({ isAuthenticated }: { isAuthenticated: boolean }) {
	const mode = isAuthenticated ? "authenticated" : "guest";
	const { isFirstRunVisible, dismissFirstRun } = useOnboarding();
	const cycleCompleteVisible = useTestIdVisible("cycle-complete-overlay");

	return (
		<DataModeProvider mode={mode}>
			{isAuthenticated && <GuestImportOnMount />}
			<FirstRunOverlay
				mode={mode}
				onDismiss={dismissFirstRun}
				visible={isFirstRunVisible && !cycleCompleteVisible}
			/>
			<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white">
				<div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
					<h1 className="font-bold text-4xl tracking-tight">FlowState</h1>
					<p className="text-white/60">Manage your tasks. Stay in flow.</p>
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
			<HomeShellContent isAuthenticated={isAuthenticated} />
		</OnboardingProvider>
	);
}
