"use client";

import { useState } from "react";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import { INTENTION_CHIP_OPTIONS } from "~/lib/session/narrative-copy";

type CycleIntentionPromptProps = {
	onSubmit: (intention: string | null) => void;
	onSkip: () => void;
	isSubmitting?: boolean;
};

export function CycleIntentionPrompt({
	onSubmit,
	onSkip,
	isSubmitting = false,
}: CycleIntentionPromptProps) {
	const [customIntention, setCustomIntention] = useState("");

	return (
		<OverlayScrim role="dialog" testId="cycle-intention-prompt" zIndex={60}>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">
					What&apos;s your focus this session?
				</h2>
				<p className="mt-2 text-sm text-text-secondary">
					Optional — one line to anchor your first cycle.
				</p>
				<div className="mt-4 flex flex-wrap justify-center gap-2">
					{INTENTION_CHIP_OPTIONS.map((chip) => (
						<button
							className="rounded-lg bg-segment-inactive px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-panel disabled:opacity-40"
							data-testid={`cycle-intention-chip-${chip.testId}`}
							disabled={isSubmitting}
							key={chip.testId}
							onClick={() => onSubmit(chip.label)}
							type="button"
						>
							{chip.label}
						</button>
					))}
				</div>
				<input
					className="mt-4 w-full rounded-lg border border-border-subtle bg-surface-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-dimmed"
					data-testid="cycle-intention-input"
					disabled={isSubmitting}
					maxLength={80}
					onChange={(event) => setCustomIntention(event.target.value)}
					placeholder="Or type your own…"
					value={customIntention}
				/>
				<button
					className={`${overlayButtonClass.primaryFull} mt-4 py-2 text-sm`}
					data-testid="cycle-intention-submit-btn"
					disabled={isSubmitting || customIntention.trim().length === 0}
					onClick={() => onSubmit(customIntention.trim())}
					type="button"
				>
					Use this focus
				</button>
				<button
					className={`${overlayButtonClass.secondaryFull} mt-2 py-2 text-sm text-text-dimmed hover:text-text-secondary`}
					data-testid="cycle-intention-skip-btn"
					disabled={isSubmitting}
					onClick={onSkip}
					type="button"
				>
					Skip
				</button>
			</OverlayCard>
		</OverlayScrim>
	);
}
