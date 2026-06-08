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
};

export function CycleAudioPreferenceControl({
	mode,
	onChange,
	disabled = false,
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

	return (
		<fieldset
			className="mt-4 border-white/10 border-t pt-4"
			data-testid="cycle-audio-preference"
		>
			<legend className="mb-2 w-full text-center text-sm text-white/70">
				Cycle end audio
			</legend>
			<div className="flex justify-center gap-1">
				{OPTIONS.map((opt, index) => {
					const isActive = opt.value === mode;
					return (
						<button
							aria-pressed={isActive}
							className={`rounded-md px-3 py-1.5 font-medium text-sm transition ${
								isActive
									? "bg-purple-600 text-white"
									: "bg-white/10 text-white/60 hover:bg-white/20"
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
