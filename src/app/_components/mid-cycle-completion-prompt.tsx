"use client";

import { useState } from "react";
import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import type { FocusedTask } from "~/hooks/use-pomodoro-cycle";
import type { DomainTask, DomainTaskId } from "~/lib/data-mode/types";

type MidCycleCompletionPromptProps = {
	pendingTask: FocusedTask;
	otherActiveTasks: DomainTask[];
	onContinueWithTask: (taskId: DomainTaskId) => Promise<void>;
	onEndCycleAndBreak: () => Promise<void>;
	isSubmitting?: boolean;
};

export function MidCycleCompletionPrompt({
	pendingTask,
	otherActiveTasks,
	onContinueWithTask,
	onEndCycleAndBreak,
	isSubmitting = false,
}: MidCycleCompletionPromptProps) {
	const [selectedTaskId, setSelectedTaskId] = useState<DomainTaskId | null>(
		null,
	);

	const hasOtherTasks = otherActiveTasks.length > 0;

	return (
		<OverlayScrim testId="mid-cycle-prompt-overlay">
			<OverlayCard centered={false}>
				<h2 className="text-center font-semibold text-2xl text-primary">
					Task complete
				</h2>
				{pendingTask != null && (
					<p className="mt-2 text-center text-sm text-text-secondary">
						{pendingTask.title}
					</p>
				)}
				<p className="mt-4 text-center text-sm text-text-secondary">
					{hasOtherTasks
						? "Continue this cycle with another task, or end now for a break."
						: "No other active tasks — end the cycle and take a break."}
				</p>

				{hasOtherTasks && (
					<ul className="mt-6 space-y-2">
						{otherActiveTasks.map((task) => (
							<li key={String(task.id)}>
								<button
									className={`w-full rounded-lg border px-4 py-3 text-left transition ${
										selectedTaskId === task.id
											? "border-focus-ring bg-energy-steady-bg text-primary"
											: "border-border-subtle bg-surface-panel text-text-section hover:border-border-subtle hover:bg-surface-card-muted"
									}`}
									disabled={isSubmitting}
									onClick={() => setSelectedTaskId(task.id)}
									type="button"
								>
									{task.title}
								</button>
							</li>
						))}
					</ul>
				)}

				<div className="mt-8 flex flex-col gap-3">
					{hasOtherTasks && (
						<button
							className={overlayButtonClass.primary}
							data-testid="mid-cycle-continue-btn"
							disabled={selectedTaskId == null || isSubmitting}
							onClick={() => {
								if (selectedTaskId != null) {
									void onContinueWithTask(selectedTaskId);
								}
							}}
							type="button"
						>
							Continue with selected task
						</button>
					)}
					<button
						className={overlayButtonClass.breakPrimary}
						data-testid="mid-cycle-end-break-btn"
						disabled={isSubmitting}
						onClick={() => void onEndCycleAndBreak()}
						type="button"
					>
						End cycle and break
					</button>
				</div>
			</OverlayCard>
		</OverlayScrim>
	);
}
