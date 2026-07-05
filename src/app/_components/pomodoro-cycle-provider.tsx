"use client";

import {
	createContext,
	type ReactNode,
	Suspense,
	useCallback,
	useContext,
	useMemo,
} from "react";

import { useCycleEndAudioPreference } from "~/hooks/use-cycle-end-audio-preference";
import { useE2eExposeCycleRecovery } from "~/hooks/use-e2e-expose-cycle-recovery";
import { useOutOfTabBreakAlertsPreference } from "~/hooks/use-out-of-tab-break-alerts-preference";
import { usePomodoroCycle } from "~/hooks/use-pomodoro-cycle";
import type { DomainTask } from "~/lib/data-mode/types";
import {
	useAuthenticatedDomainTasks,
	useGuestDomainTasks,
} from "~/lib/data-mode/use-domain-tasks";
import type { OnboardingScope } from "~/lib/onboarding/types";

type PomodoroCycleContextValue = ReturnType<typeof usePomodoroCycle> & {
	outOfTabBreakAlertsEnabled: boolean;
	setOutOfTabBreakAlertsEnabled: (enabled: boolean) => void;
};

const PomodoroCycleContext = createContext<PomodoroCycleContextValue | null>(
	null,
);

export function usePomodoroCycleContext(): PomodoroCycleContextValue {
	const context = useContext(PomodoroCycleContext);
	if (context == null) {
		throw new Error(
			"usePomodoroCycleContext must be used within PomodoroCycleProvider",
		);
	}
	return context;
}

function useCycleProviderValue(
	scope: OnboardingScope,
	tasks: DomainTask[],
): PomodoroCycleContextValue {
	const { mode: cycleEndAudioMode } = useCycleEndAudioPreference(scope);
	const {
		enabled: outOfTabBreakAlertsEnabled,
		setEnabled: setOutOfTabBreakAlertsEnabled,
	} = useOutOfTabBreakAlertsPreference(scope);

	const getCycleEndAudioMode = useCallback(
		() => cycleEndAudioMode,
		[cycleEndAudioMode],
	);
	const getOutOfTabBreakAlertsEnabled = useCallback(
		() => outOfTabBreakAlertsEnabled,
		[outOfTabBreakAlertsEnabled],
	);
	const activeTaskIds = useMemo(
		() => new Set(tasks.filter((t) => t.status === "active").map((t) => t.id)),
		[tasks],
	);
	const continueTasks = useMemo(
		() => tasks.map((task) => ({ id: task.id, status: task.status })),
		[tasks],
	);

	const pomodoro = usePomodoroCycle({
		getCycleEndAudioMode,
		getOutOfTabBreakAlertsEnabled,
		activeTaskIds,
		continueTasks,
	});
	useE2eExposeCycleRecovery();

	return useMemo(
		() => ({
			...pomodoro,
			outOfTabBreakAlertsEnabled,
			setOutOfTabBreakAlertsEnabled,
		}),
		[pomodoro, outOfTabBreakAlertsEnabled, setOutOfTabBreakAlertsEnabled],
	);
}

function GuestPomodoroCycleProvider({
	scope,
	children,
}: {
	scope: OnboardingScope;
	children: ReactNode;
}) {
	const { tasks } = useGuestDomainTasks();
	const value = useCycleProviderValue(scope, tasks);

	return (
		<PomodoroCycleContext.Provider value={value}>
			{children}
		</PomodoroCycleContext.Provider>
	);
}

function AuthenticatedPomodoroCycleProvider({
	scope,
	children,
}: {
	scope: OnboardingScope;
	children: ReactNode;
}) {
	const { tasks } = useAuthenticatedDomainTasks();
	const value = useCycleProviderValue(scope, tasks);

	return (
		<PomodoroCycleContext.Provider value={value}>
			{children}
		</PomodoroCycleContext.Provider>
	);
}

/**
 * Mounted once in the root layout, above every route that renders the timer
 * or reads cycle state — the hook's Worker + `visibilitychange` listener must
 * only ever mount once, so this component must never be rendered twice.
 */
export function PomodoroCycleProvider({
	scope,
	children,
}: {
	scope: OnboardingScope;
	children: ReactNode;
}) {
	if (scope.mode === "guest") {
		return (
			<GuestPomodoroCycleProvider scope={scope}>
				{children}
			</GuestPomodoroCycleProvider>
		);
	}

	return (
		<Suspense
			fallback={
				<p className="text-sm text-text-dimmed" data-testid="dashboard-loading">
					Loading tasks…
				</p>
			}
		>
			<AuthenticatedPomodoroCycleProvider scope={scope}>
				{children}
			</AuthenticatedPomodoroCycleProvider>
		</Suspense>
	);
}
