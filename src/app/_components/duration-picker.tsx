"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
	combineMinSecToSec,
	isDurationSecInRange,
	splitSecToMinSec,
} from "~/lib/duration-input";

type DurationPickerProps = {
	testIdPrefix: string;
	presets: ReadonlyArray<{ label: string; sec: number }>;
	valueSec: number;
	onChangeSec: (sec: number) => void;
	minSec: number;
	maxSec: number;
	boundsLabel: string;
	onValidationChange?: (invalid: boolean) => void;
	variant?: "default" | "settings";
};

function parseFieldValue(value: string): number | null {
	if (value.trim() === "") {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
		return null;
	}
	return parsed;
}

const PRESET_BUTTON_BASE =
	"rounded-control px-4 py-2 font-medium text-sm transition-colors duration-150";

function presetButtonClass(isActive: boolean): string {
	return isActive
		? `${PRESET_BUTTON_BASE} bg-segment-active text-on-cta`
		: `${PRESET_BUTTON_BASE} bg-segment-inactive text-text-secondary hover:bg-surface-card-muted hover:text-primary`;
}

const INPUT_BASE =
	"w-14 rounded-control border bg-surface-card px-2 py-1.5 text-center text-primary text-sm tabular-nums";

function inputClass(showError: boolean): string {
	return showError
		? `${INPUT_BASE} border-red-400 outline-1 outline-red-400/50`
		: `${INPUT_BASE} border-border-subtle focus:border-accent-cta focus:outline-none focus:ring-2 focus:ring-focus/30`;
}

export function DurationPicker({
	testIdPrefix,
	presets,
	valueSec,
	onChangeSec,
	minSec,
	maxSec,
	boundsLabel,
	onValidationChange,
	variant = "default",
}: DurationPickerProps) {
	const t = useTranslations("DurationPicker");
	const initial = splitSecToMinSec(valueSec);
	const [minutesStr, setMinutesStr] = useState(String(initial.minutes));
	const [secondsStr, setSecondsStr] = useState(String(initial.seconds));
	const [touched, setTouched] = useState(false);

	useEffect(() => {
		const { minutes, seconds } = splitSecToMinSec(valueSec);
		setMinutesStr(String(minutes));
		setSecondsStr(String(seconds));
	}, [valueSec]);

	const minutesParsed = parseFieldValue(minutesStr);
	const secondsParsed = parseFieldValue(secondsStr);
	const hasPartialInput = minutesParsed === null || secondsParsed === null;
	const totalSec =
		minutesParsed !== null && secondsParsed !== null
			? combineMinSecToSec(minutesParsed, secondsParsed)
			: null;
	const totalValid =
		totalSec !== null && isDurationSecInRange(totalSec, minSec, maxSec);
	const showError = touched && (hasPartialInput || !totalValid);

	useEffect(() => {
		onValidationChange?.(showError);
	}, [onValidationChange, showError]);

	const handleFieldChange = (nextMin: string, nextSec: string) => {
		setTouched(true);
		setMinutesStr(nextMin);
		setSecondsStr(nextSec);

		const min = parseFieldValue(nextMin);
		const sec = parseFieldValue(nextSec);
		if (min === null || sec === null) {
			return;
		}

		const total = combineMinSecToSec(min, sec);
		if (isDurationSecInRange(total, minSec, maxSec)) {
			onChangeSec(total);
		}
	};

	const isSettings = variant === "settings";
	const presetAlign = isSettings ? "justify-start" : "justify-center";
	const customAlign = isSettings ? "items-start" : "items-center";

	return (
		<div>
			<div className={`flex flex-wrap gap-2 ${presetAlign}`}>
				{presets.map((preset) => {
					const isActive = valueSec === preset.sec;
					return (
						<button
							aria-pressed={isActive}
							className={presetButtonClass(isActive)}
							key={preset.sec}
							onClick={() => {
								setTouched(false);
								onChangeSec(preset.sec);
							}}
							type="button"
						>
							{preset.label}
						</button>
					);
				})}
			</div>

			<div className={`mt-3 flex flex-col gap-1.5 ${customAlign}`}>
				<span className="text-text-dimmed text-xs">
					{t("customLabel", { bounds: boundsLabel })}
				</span>
				<div className="flex items-center gap-2 text-sm text-text-secondary">
					<input
						className={inputClass(showError)}
						data-testid={`${testIdPrefix}-min`}
						min={0}
						onChange={(e) => handleFieldChange(e.target.value, secondsStr)}
						type="number"
						value={minutesStr}
					/>
					<span className="text-text-dimmed text-xs">{t("minUnit")}</span>
					<input
						className={inputClass(showError)}
						data-testid={`${testIdPrefix}-sec`}
						min={0}
						onChange={(e) => handleFieldChange(minutesStr, e.target.value)}
						type="number"
						value={secondsStr}
					/>
					<span className="text-text-dimmed text-xs">{t("secUnit")}</span>
				</div>
				{showError && (
					<p
						className={`text-red-600 text-xs ${isSettings ? "" : "text-center"}`}
					>
						{t("validationError", { bounds: boundsLabel })}
					</p>
				)}
			</div>
		</div>
	);
}
