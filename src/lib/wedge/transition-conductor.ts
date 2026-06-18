/**
 * Pure wedge transition conductor (F-07).
 * Enforces at most one blocking gate overlay per beat via priority matrix.
 * Priority (highest first): return handoff block → closure → wind-down → check-in
 * → cycle intention → kickoff readiness → cycle complete.
 */

export type WedgeGate =
	| "session_closure"
	| "wind_down"
	| "check_in"
	| "cycle_intention"
	| "kickoff_readiness"
	| "cycle_complete"
	| "none";

export type WedgeConductorInput = {
	enableCheckInGate: boolean;
	enableWindDownGate: boolean;
	enableSuggestionGate: boolean;
	pendingClosureLine: string | null;
	awaitingCheckIn: boolean;
	awaitingWindDown: boolean;
	windDownRationale: string | null;
	awaitingKickoffReadiness: boolean;
	awaitingCycleIntention: boolean;
	isPostCheckInTransitioning: boolean;
	activeCycle: unknown | null;
	returnHandoffGateOpen: boolean;
	cyclePaused: boolean;
	state: "idle" | "running" | "paused" | "completed";
};

export type WedgeConductorOutput = {
	activeGate: WedgeGate;
	showSessionClosure: boolean;
	showWindDown: boolean;
	showCheckIn: boolean;
	showCycleIntention: boolean;
	showKickoffReadiness: boolean;
	showCycleComplete: boolean;
};

export type KickoffEligibilityInput = {
	mode: "guest" | "authenticated";
	state: "idle" | "running" | "paused" | "completed";
	cycleKind: string | null;
	focusedTaskId: string | number | null;
	awaitingCheckIn: boolean;
	awaitingWindDown: boolean;
	isPostCheckInTransitioning: boolean;
	pendingSuggestionStatus: string;
	pendingClosureLine: string | null;
	hasActiveTasks: boolean;
	sessionStartIdleFlag: boolean;
	postBreakIdleFlag: boolean;
	returnHandoffGateOpen: boolean;
	cyclePaused: boolean;
};

const GATE_PRIORITY: WedgeGate[] = [
	"session_closure",
	"wind_down",
	"check_in",
	"cycle_intention",
	"kickoff_readiness",
	"cycle_complete",
];

function gateCandidates(
	input: WedgeConductorInput,
): Partial<Record<WedgeGate, boolean>> {
	if (input.cyclePaused) {
		return {
			session_closure: false,
			wind_down: false,
			check_in: false,
			cycle_intention: false,
			kickoff_readiness: false,
			cycle_complete: false,
		};
	}

	const showSessionClosure = input.pendingClosureLine != null;

	const showWindDown =
		input.enableWindDownGate &&
		input.awaitingWindDown &&
		input.windDownRationale != null &&
		!showSessionClosure;

	const showCheckIn =
		input.enableCheckInGate &&
		input.awaitingCheckIn &&
		input.activeCycle != null &&
		!showSessionClosure &&
		!showWindDown;

	const showCycleIntention =
		input.awaitingCycleIntention &&
		!showSessionClosure &&
		!showWindDown &&
		!showCheckIn;

	const showKickoffReadiness =
		input.enableSuggestionGate &&
		input.awaitingKickoffReadiness &&
		!input.returnHandoffGateOpen &&
		!showSessionClosure &&
		!showCheckIn &&
		!showWindDown &&
		!input.isPostCheckInTransitioning &&
		!showCycleIntention;

	const showCycleComplete =
		input.state === "completed" &&
		!showSessionClosure &&
		!showWindDown &&
		!showCheckIn &&
		!input.isPostCheckInTransitioning &&
		!showKickoffReadiness &&
		!showCycleIntention;

	return {
		session_closure: showSessionClosure,
		wind_down: showWindDown,
		check_in: showCheckIn,
		cycle_intention: showCycleIntention,
		kickoff_readiness: showKickoffReadiness,
		cycle_complete: showCycleComplete,
	};
}

export function resolveWedgeBeat(
	input: WedgeConductorInput,
): WedgeConductorOutput {
	const candidates = gateCandidates(input);

	let activeGate: WedgeGate = "none";
	for (const gate of GATE_PRIORITY) {
		if (candidates[gate]) {
			activeGate = gate;
			break;
		}
	}

	const showSessionClosure = activeGate === "session_closure";
	const showWindDown = activeGate === "wind_down";
	const showCheckIn = activeGate === "check_in";
	const showCycleIntention = activeGate === "cycle_intention";
	const showKickoffReadiness = activeGate === "kickoff_readiness";
	const showCycleComplete = activeGate === "cycle_complete";

	return {
		activeGate,
		showSessionClosure,
		showWindDown,
		showCheckIn,
		showCycleIntention,
		showKickoffReadiness,
		showCycleComplete,
	};
}

export function computeKickoffEligible(
	input: KickoffEligibilityInput,
): boolean {
	if (input.cyclePaused || input.state === "paused") {
		return false;
	}

	if (input.returnHandoffGateOpen) {
		return false;
	}

	return (
		input.mode === "authenticated" &&
		input.state === "idle" &&
		input.cycleKind === null &&
		input.focusedTaskId === null &&
		!input.awaitingCheckIn &&
		!input.awaitingWindDown &&
		!input.isPostCheckInTransitioning &&
		input.pendingSuggestionStatus === "idle" &&
		input.pendingClosureLine == null &&
		input.hasActiveTasks &&
		(input.sessionStartIdleFlag || input.postBreakIdleFlag)
	);
}

/** Wind-down evaluation at work-cycle check-in — cycles increment after check-in. */
export function effectiveWorkCyclesAtCheckIn(
	completedWorkCycles: number,
): number {
	return completedWorkCycles + 1;
}
