"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

const DAY_START_GATE_DISMISS_KEY_PREFIX = "flowstate:day-start-gate-dismiss:";

function isDismissedForDate(localDateKey: string): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return (
		sessionStorage.getItem(
			`${DAY_START_GATE_DISMISS_KEY_PREFIX}${localDateKey}`,
		) === "1"
	);
}

function dismissForDate(localDateKey: string): void {
	if (typeof window === "undefined") {
		return;
	}
	sessionStorage.setItem(
		`${DAY_START_GATE_DISMISS_KEY_PREFIX}${localDateKey}`,
		"1",
	);
}

/**
 * Once-per-day dismiss tracker for the energy/goal steering cards. Mirrors
 * FocusBudgetPrompt's sessionStorage pattern (~/app/_components/focus-budget-prompt.tsx).
 *
 * `rawVisible` is the cycle hook's raw showSessionEnergy/showSessionFocus
 * signal, which re-arms on every new session. Dismissal is recorded on the
 * rawVisible:true -> false transition (steering answered/skipped), and from
 * then on this returns `true` for the rest of the date — even across later
 * sessions the hook re-opens steering for.
 *
 * Callers must mask their own showSessionEnergy/showSessionFocus (and any
 * state derivation fed by them, e.g. deriveHomeSessionState) with
 * `!dismissed` BEFORE rendering — masking only the rendered cards and not
 * the derived session state would leave the UI in a blank "steering" state
 * with no way to advance (a dead-end).
 */
export function useDayStartGateDismissed(
	localDateKey: string,
	rawVisible: boolean,
): boolean {
	const [dismissed, setDismissed] = useState(() =>
		isDismissedForDate(localDateKey),
	);
	const wasVisibleRef = useRef(rawVisible);

	useEffect(() => {
		setDismissed(isDismissedForDate(localDateKey));
	}, [localDateKey]);

	useEffect(() => {
		if (wasVisibleRef.current && !rawVisible) {
			dismissForDate(localDateKey);
			setDismissed(true);
		}
		wasVisibleRef.current = rawVisible;
	}, [rawVisible, localDateKey]);

	return dismissed;
}

type DayStartGateProps = {
	/** Local date key (recap-scoped) the once-per-day dismissal is keyed to. */
	localDateKey: string;
	/** Whether the underlying steering (energy/focus) cards want to show right now. */
	visible: boolean;
	children: ReactNode;
};

/** Thin render-gate wrapper over `useDayStartGateDismissed`, for standalone use/testing. */
export function DayStartGate({
	localDateKey,
	visible,
	children,
}: DayStartGateProps) {
	const dismissed = useDayStartGateDismissed(localDateKey, visible);

	if (dismissed || !visible) {
		return null;
	}

	return <>{children}</>;
}
