"use client";

import { useEffect } from "react";

import { resetActiveCycleRecoveryGuard } from "~/hooks/use-pomodoro-cycle";

declare global {
	interface Window {
		__flowstateResetCycleRecovery?: () => void;
	}
}

/** E2E only — module-level recovery guard survives Next dev reloads. */
export function useE2eExposeCycleRecovery() {
	useEffect(() => {
		if (process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER !== "1") {
			return;
		}
		window.__flowstateResetCycleRecovery = resetActiveCycleRecoveryGuard;
		return () => {
			delete window.__flowstateResetCycleRecovery;
		};
	}, []);
}
