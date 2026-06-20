"use client";

import { useState } from "react";

import {
	type CheckInEnergy,
	EnergySelector,
} from "~/app/_components/energy-selector";
import { overlayButtonClass } from "~/app/_components/overlay-shell";
import { INTENTION_CHIP_OPTIONS } from "~/lib/session/narrative-copy";

type SessionEnergyCardProps = {
	onSelect: (energy: CheckInEnergy) => void;
	onSkip: () => void;
	disabled?: boolean;
};

export function SessionEnergyCard({
	onSelect,
	onSkip,
	disabled = false,
}: SessionEnergyCardProps) {
	return (
		<div
			className="w-full max-w-lg rounded-xl border border-border-subtle bg-surface-panel/80 p-5 shadow-sm"
			data-testid="session-energy-card"
		>
			<h2 className="font-semibold text-lg text-primary">
				How&apos;s your energy to start?
			</h2>
			<p className="mt-1 text-sm text-text-secondary">
				We&apos;ll use this to suggest your first task.
			</p>
			<EnergySelector disabled={disabled} onSelect={onSelect} />
			<button
				className={`${overlayButtonClass.secondary} mt-3 w-full py-2 text-sm text-text-dimmed hover:text-text-secondary sm:py-2.5`}
				data-testid="session-energy-skip-btn"
				disabled={disabled}
				onClick={onSkip}
				type="button"
			>
				Skip
			</button>
		</div>
	);
}

type SessionFocusCardProps = {
	onComplete: (intention: string) => void;
	onSkip: () => void;
	isSubmitting?: boolean;
};

export function SessionFocusCard({
	onComplete,
	onSkip,
	isSubmitting = false,
}: SessionFocusCardProps) {
	const [customIntention, setCustomIntention] = useState("");

	const handleChipSelect = (label: string) => {
		onComplete(label);
	};

	const handleCustomSubmit = () => {
		const trimmed = customIntention.trim();
		if (trimmed.length === 0) {
			return;
		}
		onComplete(trimmed);
	};

	return (
		<div
			className="w-full max-w-lg rounded-xl border border-border-subtle bg-surface-panel/80 p-5 shadow-sm"
			data-testid="session-focus-card"
		>
			<h2 className="font-semibold text-lg text-primary">
				What&apos;s your focus this session?
			</h2>
			<p className="mt-1 text-sm text-text-secondary">
				Helps bias your first task suggestion.
			</p>
			<div className="mt-4 flex flex-wrap gap-2">
				{INTENTION_CHIP_OPTIONS.map((chip) => (
					<button
						className="rounded-lg bg-segment-inactive px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-panel disabled:opacity-40"
						data-testid={`steering-intention-${chip.testId}`}
						disabled={isSubmitting}
						key={chip.testId}
						onClick={() => handleChipSelect(chip.label)}
						type="button"
					>
						{chip.label}
					</button>
				))}
			</div>
			<input
				className="mt-3 w-full rounded-lg border border-border-subtle bg-surface-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-dimmed"
				data-testid="steering-intention-input"
				disabled={isSubmitting}
				maxLength={80}
				onChange={(event) => setCustomIntention(event.target.value)}
				placeholder="Or type your own…"
				value={customIntention}
			/>
			<div className="mt-3 flex flex-col gap-2 sm:flex-row">
				<button
					className={`${overlayButtonClass.primary} w-full flex-1 py-2 text-sm sm:py-2.5`}
					data-testid="steering-intention-submit-btn"
					disabled={isSubmitting || customIntention.trim().length === 0}
					onClick={handleCustomSubmit}
					type="button"
				>
					Use this focus
				</button>
				<button
					className={`${overlayButtonClass.secondary} w-full flex-1 py-2 text-sm text-text-dimmed hover:text-text-secondary sm:py-2.5`}
					data-testid="session-focus-skip-btn"
					disabled={isSubmitting}
					onClick={onSkip}
					type="button"
				>
					Skip
				</button>
			</div>
		</div>
	);
}
