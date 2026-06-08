"use client";

import type { CycleKind } from "~/hooks/use-pomodoro-cycle";
import { getCatchUpCopy } from "~/lib/catch-up/copy";
import { formatEndedAgo } from "~/lib/catch-up/format-ended-ago";
import type { CatchUpState } from "~/lib/catch-up/types";

type TabReturnCatchUpProps = {
	catchUp: NonNullable<CatchUpState>;
	taskTitle?: string;
	cycleKind?: CycleKind | null;
	className?: string;
};

export function TabReturnCatchUp({
	catchUp,
	taskTitle,
	cycleKind = null,
	className,
}: TabReturnCatchUpProps) {
	const endedAgo = formatEndedAgo(catchUp.cycleEndedAtMs);
	const copy = getCatchUpCopy(catchUp.gate, {
		taskTitle,
		cycleKind,
		endedAgo,
	});

	const isBreakGate =
		catchUp.gate === "BREAK_CONFIRM" ||
		cycleKind === "SHORT_BREAK" ||
		cycleKind === "LONG_BREAK";

	return (
		<div
			className={`rounded-t-xl border border-b-0 px-6 py-4 text-center ${
				isBreakGate
					? "border-teal-400/30 bg-[#1a2e2e] text-teal-100"
					: "border-purple-400/30 bg-[#1a1a2e] text-purple-100"
			} ${className ?? ""}`}
			data-testid="tab-return-catchup"
		>
			<p className="font-semibold text-sm tracking-wide">{copy.headline}</p>
			<p className="mt-1 text-xs opacity-80">{endedAgo}</p>
			<p className="mt-2 text-sm opacity-90">{copy.subcopy}</p>
		</div>
	);
}
