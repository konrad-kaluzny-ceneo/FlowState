"use client";

import type { PomodoroCycleState } from "~/hooks/use-pomodoro-cycle";

type FocusedTask = {
	id: number;
	title: string;
} | null;

type CycleCompleteOverlayProps = {
	state: PomodoroCycleState;
	focusedTask: FocusedTask;
	canMarkTaskDone: boolean;
	onConfirm: (markTaskDone: boolean) => Promise<void>;
	isConfirming?: boolean;
};

export function CycleCompleteOverlay({
	state,
	focusedTask,
	canMarkTaskDone,
	onConfirm,
	isConfirming = false,
}: CycleCompleteOverlayProps) {
	if (state !== "completed") {
		return null;
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			data-testid="cycle-complete-overlay"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">Cycle Complete!</h2>
				{focusedTask != null && (
					<p className="mt-2 text-white/70">{focusedTask.title}</p>
				)}
				<div className="mt-8 flex flex-col gap-3">
					<button
						className="rounded-lg bg-green-600 py-3 font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
						disabled={!canMarkTaskDone || isConfirming}
						onClick={() => void onConfirm(true)}
						type="button"
					>
						Done — mark task complete
					</button>
					<button
						className="rounded-lg border border-white/30 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
						disabled={isConfirming}
						onClick={() => void onConfirm(false)}
						type="button"
					>
						Continue later
					</button>
				</div>
				{!canMarkTaskDone && (
					<p className="mt-4 text-white/50 text-xs">
						This task is no longer active — you can only continue later.
					</p>
				)}
			</div>
		</div>
	);
}
