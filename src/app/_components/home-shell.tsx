"use client";

import { GuestBanner } from "~/app/_components/guest-banner";
import { GuestImportOnMount } from "~/app/_components/guest-import-on-mount";
import { PomodoroDashboard } from "~/app/_components/pomodoro-dashboard";
import { DataModeProvider } from "~/lib/data-mode/data-mode-context";

type HomeShellProps = {
	isAuthenticated: boolean;
};

export function HomeShell({ isAuthenticated }: HomeShellProps) {
	const mode = isAuthenticated ? "authenticated" : "guest";

	return (
		<DataModeProvider mode={mode}>
			{isAuthenticated && <GuestImportOnMount />}
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
