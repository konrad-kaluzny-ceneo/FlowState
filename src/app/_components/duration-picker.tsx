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

export function DurationPicker({
	testIdPrefix,
	presets,
	valueSec,
	onChangeSec,
	minSec,
	maxSec,
	boundsLabel,
	onValidationChange,
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

	return (
		<div>
			<div className="flex flex-wrap justify-center gap-2">
				{presets.map((preset) => {
					const isActive = valueSec === preset.sec;
					return (
						<button
							aria-pressed={isActive}
							className={`rounded-lg px-3 py-2 text-sm transition ${
								isActive
									? "bg-segment-active text-on-cta"
									: "bg-segment-inactive text-text-secondary hover:bg-surface-panel"
							}`}
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

			<div className="mt-4 flex flex-col items-center gap-1">
				<span className="text-sm text-text-secondary">
					{t("customLabel", { bounds: boundsLabel })}
				</span>
				<div className="flex items-center gap-2 text-sm text-text-secondary">
					<input
						className={`w-14 rounded border bg-surface-panel px-2 py-1 text-center text-primary ${
							showError
								? "border-red-400 outline-1 outline-red-400/50"
								: "border-border-subtle"
						}`}
						data-testid={`${testIdPrefix}-min`}
						min={0}
						onChange={(e) => handleFieldChange(e.target.value, secondsStr)}
						type="number"
						value={minutesStr}
					/>
					<span className="text-text-dimmed">{t("minUnit")}</span>
					<input
						className={`w-14 rounded border bg-surface-panel px-2 py-1 text-center text-primary ${
							showError
								? "border-red-400 outline-1 outline-red-400/50"
								: "border-border-subtle"
						}`}
						data-testid={`${testIdPrefix}-sec`}
						min={0}
						onChange={(e) => handleFieldChange(minutesStr, e.target.value)}
						type="number"
						value={secondsStr}
					/>
					<span className="text-text-dimmed">{t("secUnit")}</span>
				</div>
				{showError && (
					<p className="text-center text-red-600 text-xs">
						{t("validationError", { bounds: boundsLabel })}
					</p>
				)}
			</div>
		</div>
	);
}
