"use client";

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

type TimerPanelProps = {
	state: PomodoroCycleState;
	remainingMs: number;
	focusedTask: FocusedTask;
	onStart: (durationSec: number) => Promise<void>;
	onInterrupt: () => Promise<void>;
	isStarting?: boolean;
	cycleKind?: CycleKind | null;
	preferredWorkDurationSec?: number | null;
	onWorkDurationManualChange?: () => void;
	cycleEndAudioMode?: CycleEndAudioMode;
	onCycleEndAudioModeChange?: (mode: CycleEndAudioMode) => void;
};

export function TimerPanel({
	state,
	remainingMs,
	focusedTask,
	onStart,
	onInterrupt,
	isStarting = false,
	cycleKind = null,
	preferredWorkDurationSec = null,
	onWorkDurationManualChange,
	cycleEndAudioMode = "normal",
	onCycleEndAudioModeChange,
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

	if (focusedTask == null && state !== "running" && state !== "completed") {
		return null;
	}

	if (state === "completed") {
		return null;
	}

	if (state === "running") {
		const isBreak = cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";
		const breakLabel =
			cycleKind === "LONG_BREAK" ? "Long Break" : "Short Break";

		return (
			<section
				className={`w-full max-w-lg rounded-xl border p-6 text-center ${
					isBreak
						? "border-teal-400/30 bg-teal-900/20"
						: "border-white/20 bg-white/10"
				}`}
				data-testid="timer-panel-running"
			>
				<p className="text-sm text-white/60">
					{isBreak ? breakLabel : "Focusing on"}
				</p>
				{!isBreak && (
					<p className="mt-1 font-medium text-lg text-white">
						{focusedTask?.title ?? "Task"}
					</p>
				)}
				<p
					className={`mt-4 font-bold font-mono text-6xl tabular-nums tracking-tight ${
						isBreak ? "text-teal-200" : ""
					}`}
					data-testid="timer-countdown"
				>
					{formatRemainingMs(remainingMs)}
				</p>
				<button
					className="mt-6 rounded-lg border border-white/30 px-4 py-2 text-sm text-white/80 transition hover:border-red-400/60 hover:text-red-300"
					onClick={() => void onInterrupt()}
					type="button"
				>
					{isBreak ? "End break early" : "Interrupt"}
				</button>
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
			className="w-full max-w-lg rounded-xl border border-white/20 bg-white/10 p-6"
			data-testid="timer-panel-idle"
		>
			<p className="text-center text-sm text-white/60">Ready to focus on</p>
			<p className="text-center font-medium text-lg text-white">
				{focusedTask?.title}
			</p>

			<p className="mt-4 text-center text-sm text-white/70">Work duration</p>
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
				className="mt-6 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
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

			<div className="mt-4 border-white/10 border-t pt-4">
				<button
					className="w-full text-center text-sm text-white/50 transition hover:text-white/70"
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
							<p className="mb-2 text-center text-sm text-white/70">
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
							<p className="mb-2 text-center text-sm text-white/70">
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
