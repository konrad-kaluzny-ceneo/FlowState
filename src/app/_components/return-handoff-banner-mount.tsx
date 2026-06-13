"use client";

import { ReturnHandoffBanner } from "~/app/_components/return-handoff-banner";
import { useReturnHandoff } from "~/hooks/use-return-handoff";
import { useTestIdVisible } from "~/hooks/use-test-id-visible";

const WEDGE_GATE_TEST_IDS = [
	"cycle-complete-overlay",
	"first-run-overlay",
	"merge-success-overlay",
	"check-in-overlay",
	"task-suggestion-card",
	"session-closure-overlay",
	"wind-down-overlay",
	"kickoff-readiness-overlay",
] as const;

function useWedgeGateSuppressed(): boolean {
	const cycleComplete = useTestIdVisible("cycle-complete-overlay");
	const firstRun = useTestIdVisible("first-run-overlay");
	const mergeSuccess = useTestIdVisible("merge-success-overlay");
	const checkIn = useTestIdVisible("check-in-overlay");
	const suggestion = useTestIdVisible("task-suggestion-card");
	const closure = useTestIdVisible("session-closure-overlay");
	const windDown = useTestIdVisible("wind-down-overlay");
	const kickoffReadiness = useTestIdVisible("kickoff-readiness-overlay");

	return (
		cycleComplete ||
		firstRun ||
		mergeSuccess ||
		checkIn ||
		suggestion ||
		closure ||
		windDown ||
		kickoffReadiness
	);
}

export function ReturnHandoffBannerMount({
	isAuthenticated,
}: {
	isAuthenticated: boolean;
}) {
	const suppressed = useWedgeGateSuppressed();
	const { handoffLine, visible, dismiss } = useReturnHandoff(
		isAuthenticated,
		suppressed,
	);

	if (handoffLine == null) {
		return null;
	}

	return (
		<ReturnHandoffBanner
			line={handoffLine}
			onDismiss={dismiss}
			visible={visible}
		/>
	);
}

export { WEDGE_GATE_TEST_IDS };
