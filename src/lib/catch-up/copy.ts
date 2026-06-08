import type { CatchUpGate } from "./types";

export type CatchUpCopyContext = {
	taskTitle?: string;
	cycleKind?: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	endedAgo: string;
};

export type CatchUpCopy = {
	headline: string;
	subcopy: string;
};

function breakLabel(cycleKind: CatchUpCopyContext["cycleKind"]): string {
	if (cycleKind === "LONG_BREAK") {
		return "Long break";
	}
	if (cycleKind === "SHORT_BREAK") {
		return "Short break";
	}
	return "Break";
}

export function getCatchUpCopy(
	gate: CatchUpGate,
	ctx: CatchUpCopyContext,
): CatchUpCopy {
	switch (gate) {
		case "WORK_CONFIRM": {
			const title = ctx.taskTitle?.trim() || "Work cycle";
			return {
				headline: `${title} finished while you were away`,
				subcopy: `Ended ${ctx.endedAgo}. Confirm your next step below.`,
			};
		}
		case "BREAK_CONFIRM":
			return {
				headline: `${breakLabel(ctx.cycleKind)} finished while you were away`,
				subcopy: `Ended ${ctx.endedAgo}. Ready for your next cycle when you are.`,
			};
		case "CHECK_IN":
			return {
				headline: "Work cycle finished while you were away",
				subcopy: `Ended ${ctx.endedAgo}. Take a moment for your energy check-in below.`,
			};
		case "SUGGESTION_ACCEPT":
			return {
				headline: "A task suggestion is waiting",
				subcopy: `Ended ${ctx.endedAgo}. Review the suggested next task below.`,
			};
	}
}
