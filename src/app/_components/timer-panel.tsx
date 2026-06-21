"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";

import type {
	CycleKind,
	FocusedTask,
	PomodoroCycleState,
} from "~/hooks/use-pomodoro-cycle";
import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";
import {
	getLongBreakPresets,
	getMaxBreakDurationSec,
	getMaxWorkDurationSec,
	getMinBreakDurationSec,
	getMinWorkDurationSec,
	getShortBreakPresets,
	getWorkDurationPresets,
} from "~/lib/duration-bounds";
import { isDurationSecInRange } from "~/lib/duration-input";
import {
	getLastDuration,
	getLongBreakDuration,
	getShortBreakDuration,
	setLongBreakDuration,
	setShortBreakDuration,
} from "~/lib/duration-storage";
import { formatRemainingMs } from "~/lib/format-remaining";

import { CycleAudioPreferenceControl } from "./cycle-audio-preference-control";
import { DurationPicker } from "./duration-picker";
import { OutOfTabBreakAlertsControl } from "./out-of-tab-break-alerts-control";

function OutOfTabBreakAlertsSection({
	enabled,
	onChange,
}: {
	enabled: boolean;
	onChange: (enabled: boolean) => void;
}) {
	return <OutOfTabBreakAlertsControl enabled={enabled} onChange={onChange} />;
}

type TimerPanelProps = {
	state: PomodoroCycleState;
	remainingMs: number;
	focusedTask: FocusedTask;
	onStart: (durationSec: number) => Promise<void>;
	onPause: () => Promise<void>;
	onResume: () => Promise<void>;
	onInterrupt: () => Promise<void>;
	isStarting?: boolean;
	cycleKind?: CycleKind | null;
	preferredWorkDurationSec?: number | null;
	onWorkDurationManualChange?: () => void;
	cycleEndAudioMode?: CycleEndAudioMode;
	onCycleEndAudioModeChange?: (mode: CycleEndAudioMode) => void;
	outOfTabBreakAlertsEnabled?: boolean;
	onOutOfTabBreakAlertsChange?: (enabled: boolean) => void;
};

export function TimerPanel({
	state,
	remainingMs,
	focusedTask,
	onStart,
	onPause,
	onResume,
	onInterrupt,
	isStarting = false,
	cycleKind = null,
	preferredWorkDurationSec = null,
	onWorkDurationManualChange,
	cycleEndAudioMode = "normal",
	onCycleEndAudioModeChange,
	outOfTabBreakAlertsEnabled = true,
	onOutOfTabBreakAlertsChange,
}: TimerPanelProps) {
	const [workDurationSec, setWorkDurationSec] = useState(
		() => preferredWorkDurationSec ?? getLastDuration(),
	);
	const [shortBreakSec, setShortBreakSec] = useState(() =>
		getShortBreakDuration(),
	);
	const [longBreakSec, setLongBreakSec] = useState(() =>
		getLongBreakDuration(),
	);
	const [workPickerInvalid, setWorkPickerInvalid] = useState(false);
	const [showBreakSettings, setShowBreakSettings] = useState(false);

	useEffect(() => {
		if (preferredWorkDurationSec != null) {
			setWorkDurationSec(preferredWorkDurationSec);
		}
	}, [preferredWorkDurationSec]);

	const workMinSec = getMinWorkDurationSec();
	const workMaxSec = getMaxWorkDurationSec();
	const breakMinSec = getMinBreakDurationSec();
	const breakMaxSec = getMaxBreakDurationSec();

	if (
		focusedTask == null &&
		state !== "running" &&
		state !== "paused" &&
		state !== "completed"
	) {
		return null;
	}

	if (state === "completed") {
		return null;
	}

	if (state === "running" || state === "paused") {
		const isBreak = cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";
		const breakLabel =
			cycleKind === "LONG_BREAK" ? "Long Break" : "Short Break";
		const isPaused = state === "paused";

		return (
			<section
				className={`w-full max-w-lg rounded-xl border p-6 text-center shadow-sm ${
					isBreak
						? "border-border-break bg-surface-break"
						: "border-card-border bg-surface-card"
				}`}
				data-testid={isPaused ? "timer-panel-paused" : "timer-panel-running"}
			>
				<p className="font-semibold text-sm text-text-section">
					{isPaused
						? isBreak
							? "Break paused"
							: "Paused"
						: isBreak
							? breakLabel
							: "Focusing on"}
				</p>
				{!isBreak && (
					<p className="mt-1 font-semibold text-primary text-xl">
						{focusedTask?.title ?? "Task"}
					</p>
				)}
				<p
					className={`mt-4 font-mono font-semibold text-6xl tabular-nums tracking-tight ${
						isBreak ? "text-accent-break" : "text-primary"
					}`}
					data-testid="timer-countdown"
				>
					{formatRemainingMs(remainingMs)}
				</p>
				{isPaused ? (
					<button
						aria-label={isBreak ? "Resume break" : "Resume"}
						className="mt-6 flex w-full items-center justify-center rounded-lg bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
						data-testid="timer-resume"
						onClick={() => void onResume()}
						type="button"
					>
						<Play aria-hidden="true" className="h-5 w-5" />
					</button>
				) : (
					<div className="mt-6 flex flex-col gap-3">
						<button
							aria-label={isBreak ? "Pause break" : "Pause"}
							className="flex w-full items-center justify-center rounded-lg bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
							data-testid="timer-pause"
							onClick={() => void onPause()}
							type="button"
						>
							<Pause aria-hidden="true" className="h-5 w-5" />
						</button>
						<button
							aria-label={isBreak ? "End break early" : "Interrupt"}
							className="flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2 font-semibold text-on-cta transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
							data-testid="timer-interrupt"
							onClick={() => void onInterrupt()}
							type="button"
						>
							<Square aria-hidden="true" className="h-4 w-4" />
						</button>
					</div>
				)}
				{onOutOfTabBreakAlertsChange != null && (
					<div className="mt-6">
						<OutOfTabBreakAlertsSection
							enabled={outOfTabBreakAlertsEnabled}
							onChange={onOutOfTabBreakAlertsChange}
						/>
					</div>
				)}
			</section>
		);
	}

	const workValid = isDurationSecInRange(
		workDurationSec,
		workMinSec,
		workMaxSec,
	);

	return (
		<section
			className="w-full max-w-lg rounded-xl border border-card-border bg-surface-card p-6 shadow-sm"
			data-testid="timer-panel-idle"
		>
			<p className="text-center font-semibold text-sm text-text-section">
				Ready to focus on
			</p>
			<p className="text-center font-semibold text-primary text-xl">
				{focusedTask?.title}
			</p>

			<p className="mt-4 text-center text-sm text-text-secondary">
				Work duration
			</p>
			<DurationPicker
				boundsLabel="1 s – 90 min"
				maxSec={workMaxSec}
				minSec={workMinSec}
				onChangeSec={(sec) => {
					onWorkDurationManualChange?.();
					setWorkDurationSec(sec);
				}}
				onValidationChange={setWorkPickerInvalid}
				presets={getWorkDurationPresets()}
				testIdPrefix="work-duration"
				valueSec={workDurationSec}
			/>

			<button
				className="mt-6 w-full rounded-lg bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover disabled:opacity-50"
				disabled={isStarting || workPickerInvalid || !workValid}
				onClick={() => void onStart(workDurationSec)}
				type="button"
			>
				{isStarting ? "Starting..." : "Start Cycle"}
			</button>

			{onCycleEndAudioModeChange != null && (
				<CycleAudioPreferenceControl
					mode={cycleEndAudioMode}
					onChange={onCycleEndAudioModeChange}
				/>
			)}

			{onOutOfTabBreakAlertsChange != null && (
				<OutOfTabBreakAlertsSection
					enabled={outOfTabBreakAlertsEnabled}
					onChange={onOutOfTabBreakAlertsChange}
				/>
			)}

			<div className="mt-4 border-border-subtle border-t pt-4">
				<button
					className="w-full text-center text-sm text-text-dimmed transition hover:text-text-secondary"
					data-testid="break-settings-toggle"
					onClick={() => setShowBreakSettings(!showBreakSettings)}
					type="button"
				>
					{showBreakSettings ? "Hide break settings ▲" : "Break settings ▼"}
				</button>

				{showBreakSettings && (
					<div
						className="mt-3 flex flex-col gap-4"
						data-testid="break-settings-panel"
					>
						<div>
							<p className="mb-2 text-center text-sm text-text-secondary">
								Short break
							</p>
							<DurationPicker
								boundsLabel="1 s – 30 min"
								maxSec={breakMaxSec}
								minSec={breakMinSec}
								onChangeSec={(sec) => {
									setShortBreakSec(sec);
									setShortBreakDuration(sec);
								}}
								presets={getShortBreakPresets()}
								testIdPrefix="short-break-duration"
								valueSec={shortBreakSec}
							/>
						</div>
						<div>
							<p className="mb-2 text-center text-sm text-text-secondary">
								Long break
							</p>
							<DurationPicker
								boundsLabel="1 s – 30 min"
								maxSec={breakMaxSec}
								minSec={breakMinSec}
								onChangeSec={(sec) => {
									setLongBreakSec(sec);
									setLongBreakDuration(sec);
								}}
								presets={getLongBreakPresets()}
								testIdPrefix="long-break-duration"
								valueSec={longBreakSec}
							/>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}
