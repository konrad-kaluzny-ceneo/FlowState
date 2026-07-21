/** Kinds of Pomodoro cycle the timer hub can run. */
export type CycleKind = "WORK" | "SHORT_BREAK" | "LONG_BREAK";

/** The break subset of {@link CycleKind}. */
export type BreakCycleKind = Extract<CycleKind, "SHORT_BREAK" | "LONG_BREAK">;
