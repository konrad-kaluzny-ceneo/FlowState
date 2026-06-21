"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import type {
	CycleKind,
	FocusedTask,
	PomodoroCycleState,
} from "~/hooks/use-pomodoro-cycle";

type CycleCompleteOverlayProps = {
	state: PomodoroCycleState;
	focusedTask: FocusedTask;
	canMarkTaskDone: boolean;
	onConfirm: (markTaskDone: boolean) => Promise<void>;
	isConfirming?: boolean;
	cycleKind?: CycleKind | null;
	preFocusedTask?: FocusedTask;
	onDismissPreFocus?: () => void;
	reentryCopy?: string | null;
};

export function CycleCompleteOverlay({
	state,
	focusedTask,
	canMarkTaskDone,
	onConfirm,
	isConfirming = false,
	cycleKind = null,
	preFocusedTask = null,
	onDismissPreFocus,
	reentryCopy = null,
}: CycleCompleteOverlayProps) {
	if (state !== "completed") {
		return null;
	}

	const isBreak = cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";

	if (isBreak) {
		const hasPreFocus = preFocusedTask != null;

		return (
			<OverlayScrim testId="cycle-complete-overlay">
				<OverlayCard variant="break">
					<h2 className="font-semibold text-2xl text-accent-break">
						Break&apos;s over!
					</h2>
					<p
						className="mt-2 text-sm text-text-secondary"
						data-testid="break-reentry-copy"
					>
						{reentryCopy ??
							`${cycleKind === "LONG_BREAK" ? "Long break" : "Short break"} complete — ready for the next cycle.`}
					</p>
					<div className="mt-8 flex flex-col gap-3">
						<button
							className={overlayButtonClass.breakPrimary}
							data-testid={
								hasPreFocus
									? "break-continue-suggested-btn"
									: "break-continue-btn"
							}
							disabled={isConfirming}
							onClick={() => void onConfirm(false)}
							type="button"
						>
							{hasPreFocus
								? `Continue with ${preFocusedTask.title}`
								: "Continue"}
						</button>
						{hasPreFocus && onDismissPreFocus != null && (
							<button
								className={overlayButtonClass.breakSecondary}
								disabled={isConfirming}
								onClick={onDismissPreFocus}
								type="button"
							>
								Choose different task
							</button>
						)}
					</div>
				</OverlayCard>
			</OverlayScrim>
		);
	}

	return (
		<OverlayScrim testId="cycle-complete-overlay">
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">Cycle Complete!</h2>
				{focusedTask != null && (
					<p className="mt-2 text-sm text-text-secondary">
						{focusedTask.title}
					</p>
				)}
				<div className="mt-8 flex flex-col gap-3">
					<button
						className={overlayButtonClass.success}
						disabled={!canMarkTaskDone || isConfirming}
						onClick={() => void onConfirm(true)}
						type="button"
					>
						Done — mark task complete
					</button>
					<button
						className={overlayButtonClass.secondary}
						disabled={isConfirming}
						onClick={() => void onConfirm(false)}
						type="button"
					>
						Continue later
					</button>
				</div>
				{!canMarkTaskDone && (
					<p className="mt-4 text-text-dimmed text-xs">
						This task is no longer active — you can only continue later.
					</p>
				)}
			</OverlayCard>
		</OverlayScrim>
	);
}
