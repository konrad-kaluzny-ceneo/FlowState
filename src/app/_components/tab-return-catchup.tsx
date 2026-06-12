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
					? "border-border-break bg-surface-break text-accent-break"
					: "border-border-subtle bg-surface-overlay text-accent-cta"
			} ${className ?? ""}`}
			data-testid="tab-return-catchup"
		>
			<p className="font-semibold text-sm tracking-wide">{copy.headline}</p>
			<p className="mt-1 text-text-dimmed text-xs">{endedAgo}</p>
			<p className="mt-2 text-sm text-text-secondary">{copy.subcopy}</p>
		</div>
	);
}
