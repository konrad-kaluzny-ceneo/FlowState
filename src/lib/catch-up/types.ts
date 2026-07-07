export type CatchUpGate = "WORK_CONFIRM" | "CHECK_IN" | "BREAK_CONFIRM";

export type CatchUpState = {
	endedWhileHidden: true;
	cycleEndedAtMs: number;
	gate: CatchUpGate;
} | null;
