"use client";

import { useCallback, useRef } from "react";

import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";

const OPTIONS: { value: CycleEndAudioMode; label: string }[] = [
	{ value: "normal", label: "Normal" },
	{ value: "soft", label: "Soft" },
	{ value: "muted", label: "Muted" },
];

type CycleAudioPreferenceControlProps = {
	mode: CycleEndAudioMode;
	onChange: (mode: CycleEndAudioMode) => void;
	disabled?: boolean;
	variant?: "default" | "settings";
};

export function CycleAudioPreferenceControl({
	mode,
	onChange,
	disabled = false,
	variant = "default",
}: CycleAudioPreferenceControlProps) {
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const handleKeyDown = useCallback(
		(index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
			if (disabled) {
				return;
			}

			let nextIndex: number | null = null;
			if (event.key === "ArrowRight" || event.key === "ArrowDown") {
				nextIndex = (index + 1) % OPTIONS.length;
			} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
				nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
			}

			if (nextIndex != null) {
				event.preventDefault();
				const next = OPTIONS[nextIndex];
				if (next != null) {
					onChange(next.value);
					buttonRefs.current[nextIndex]?.focus();
				}
			}
		},
		[disabled, onChange],
	);

	const isSettings = variant === "settings";

	return (
		<fieldset
			className={
				isSettings ? "border-0 p-0" : "mt-4 border-border-subtle border-t pt-4"
			}
			data-testid="cycle-audio-preference"
		>
			{!isSettings && (
				<legend className="mb-2 w-full text-center text-sm text-text-secondary">
					Cycle end audio
				</legend>
			)}
			<div
				className={`flex gap-1 ${isSettings ? "flex-wrap justify-start" : "justify-center"}`}
			>
				{OPTIONS.map((opt, index) => {
					const isActive = opt.value === mode;
					return (
						<button
							aria-pressed={isActive}
							className={`rounded-control px-4 py-2 font-medium text-sm transition-colors duration-150 ${
								isActive
									? "bg-segment-active text-on-cta"
									: "bg-segment-inactive text-text-secondary hover:bg-surface-card-muted hover:text-primary"
							} disabled:cursor-not-allowed disabled:opacity-50`}
							data-testid={`cycle-audio-preference-${opt.value}`}
							disabled={disabled}
							key={opt.value}
							onClick={() => onChange(opt.value)}
							onKeyDown={(event) => handleKeyDown(index, event)}
							ref={(element) => {
								buttonRefs.current[index] = element;
							}}
							type="button"
						>
							{opt.label}
						</button>
					);
				})}
			</div>
		</fieldset>
	);
}
