"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY_PREFIX = "flowstate:focus-budget-dismiss:";

const PRESET_MINUTES = [
	{ label: "2h", minutes: 120 },
	{ label: "4h", minutes: 240 },
	{ label: "6h", minutes: 360 },
] as const;

type FocusBudgetPromptProps = {
	localDateKey: string;
	hasBudget: boolean;
	isLoading: boolean;
	isSettingBudget: boolean;
	onSetBudget: (minutes: number) => Promise<void>;
};

function isDismissedForDate(localDateKey: string): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${localDateKey}`) === "1";
}

function dismissForDate(localDateKey: string): void {
	sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${localDateKey}`, "1");
}

export function FocusBudgetPrompt({
	localDateKey,
	hasBudget,
	isLoading,
	isSettingBudget,
	onSetBudget,
}: FocusBudgetPromptProps) {
	const [dismissed, setDismissed] = useState(() =>
		isDismissedForDate(localDateKey),
	);
	const [customMinutes, setCustomMinutes] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setDismissed(isDismissedForDate(localDateKey));
	}, [localDateKey]);

	const handleSetBudget = useCallback(
		async (minutes: number) => {
			setError(null);
			try {
				await onSetBudget(minutes);
			} catch {
				setError("Could not save focus hours. Try again.");
			}
		},
		[onSetBudget],
	);

	const handleCustomSubmit = useCallback(async () => {
		const parsed = Number.parseInt(customMinutes.trim(), 10);
		if (!Number.isFinite(parsed) || parsed < 15 || parsed > 720) {
			setError("Enter focus hours between 15 and 720 minutes.");
			return;
		}
		await handleSetBudget(parsed);
	}, [customMinutes, handleSetBudget]);

	const handleDismiss = useCallback(() => {
		dismissForDate(localDateKey);
		setDismissed(true);
	}, [localDateKey]);

	if (hasBudget || isLoading || dismissed) {
		return null;
	}

	return (
		<div
			className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface-panel px-4 py-3"
			data-testid="focus-budget-prompt"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="font-medium text-primary text-sm">
						Today&apos;s focus hours
					</p>
					<p className="text-text-secondary text-xs">
						Set a daily budget so suggestions fit what you have left.
					</p>
				</div>
				<button
					aria-label="Dismiss focus budget prompt"
					className="shrink-0 text-text-dimmed text-xs hover:text-text-section"
					onClick={handleDismiss}
					type="button"
				>
					Not now
				</button>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				{PRESET_MINUTES.map((preset) => (
					<button
						className="rounded-lg bg-segment-inactive px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-card-muted disabled:opacity-50"
						disabled={isSettingBudget}
						key={preset.minutes}
						onClick={() => void handleSetBudget(preset.minutes)}
						type="button"
					>
						{preset.label}
					</button>
				))}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<input
					aria-label="Custom focus minutes"
					className="w-24 rounded-md bg-surface-card px-2 py-1 text-primary text-xs placeholder:text-text-dimmed focus:outline-none"
					inputMode="numeric"
					max={720}
					min={15}
					onChange={(event) => {
						setCustomMinutes(event.target.value);
						setError(null);
					}}
					placeholder="Custom"
					type="number"
					value={customMinutes}
				/>
				<button
					className="rounded-lg bg-accent-cta px-3 py-1.5 font-medium text-on-cta text-xs transition hover:bg-accent-cta-hover disabled:opacity-50"
					disabled={isSettingBudget || customMinutes.trim() === ""}
					onClick={() => void handleCustomSubmit()}
					type="button"
				>
					Set
				</button>
			</div>
			{error != null && (
				<p className="mt-2 text-red-300 text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
