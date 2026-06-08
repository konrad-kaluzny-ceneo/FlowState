export type CatchUpGate =
	| "WORK_CONFIRM"
	| "CHECK_IN"
	| "BREAK_CONFIRM"
	| "SUGGESTION_ACCEPT";

export type CatchUpState = {
	endedWhileHidden: true;
	cycleEndedAtMs: number;
	gate: CatchUpGate;
} | null;
