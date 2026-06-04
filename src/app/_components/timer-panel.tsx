"use client";

import { useState } from "react";

import type {
	CycleKind,
	FocusedTask,
	PomodoroCycleState,
} from "~/hooks/use-pomodoro-cycle";
import {
	getMaxWorkDurationSec,
	getMinCustomWorkDurationSec,
	getWorkDurationPresets,
	isE2eFastDurationsEnabled,
} from "~/lib/duration-bounds";
import {
	getLastDuration,
	getLongBreakDuration,
	getShortBreakDuration,
	setLongBreakDuration,
	setShortBreakDuration,
} from "~/lib/duration-storage";
import { formatRemainingMs } from "~/lib/format-remaining";

const DURATION_PRESETS_SEC = getWorkDurationPresets();
const MIN_CUSTOM_DURATION_SEC = getMinCustomWorkDurationSec();
const MAX_DURATION_SEC = getMaxWorkDurationSec();
const MIN_CUSTOM_MINUTES = Math.ceil(MIN_CUSTOM_DURATION_SEC / 60);

function presetToCustomMinutes(sec: number): string {
	return sec < 60 ? "" : String(sec / 60);
}

function initialDurationState() {
	const sec = getLastDuration();
	return {
		selectedSec: sec,
		customMinutes: presetToCustomMinutes(sec),
	};
}

type TimerPanelProps = {
	state: PomodoroCycleState;
	remainingMs: number;
	focusedTask: FocusedTask;
	onStart: (durationSec: number) => Promise<void>;
	onInterrupt: () => Promise<void>;
	isStarting?: boolean;
	cycleKind?: CycleKind | null;
};

export function TimerPanel({
	state,
	remainingMs,
	focusedTask,
	onStart,
	onInterrupt,
	isStarting = false,
	cycleKind = null,
}: TimerPanelProps) {
	const [selectedSec, setSelectedSec] = useState(
		() => initialDurationState().selectedSec,
	);
	const [customMinutes, setCustomMinutes] = useState(
		() => initialDurationState().customMinutes,
	);
	const [shortBreakMin, setShortBreakMin] = useState(() =>
		Math.round(getShortBreakDuration() / 60),
	);
	const [longBreakMin, setLongBreakMin] = useState(() =>
		Math.round(getLongBreakDuration() / 60),
	);
	const [showBreakSettings, setShowBreakSettings] = useState(false);

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

	const customSec = Number.parseInt(customMinutes, 10) * 60;
	const customValid =
		Number.isFinite(customSec) &&
		customSec >= MIN_CUSTOM_DURATION_SEC &&
		customSec <= MAX_DURATION_SEC;
	const usingPreset = DURATION_PRESETS_SEC.some((p) => p.sec === selectedSec);
	const customTouched =
		customMinutes !== "" &&
		!DURATION_PRESETS_SEC.some((p) => p.sec === customSec);
	const showCustomError = !usingPreset && customTouched && !customValid;

	return (
		<section
			className="w-full max-w-lg rounded-xl border border-white/20 bg-white/10 p-6"
			data-testid="timer-panel-idle"
		>
			<p className="text-center text-sm text-white/60">Ready to focus on</p>
			<p className="text-center font-medium text-lg text-white">
				{focusedTask?.title}
			</p>

			<div className="mt-4 flex flex-wrap justify-center gap-2">
				{DURATION_PRESETS_SEC.map((preset) => (
					<button
						className={`rounded-lg px-3 py-2 text-sm transition ${
							selectedSec === preset.sec
								? "bg-purple-600 text-white"
								: "bg-white/10 text-white/80 hover:bg-white/20"
						}`}
						key={preset.sec}
						onClick={() => {
							setSelectedSec(preset.sec);
							setCustomMinutes(presetToCustomMinutes(preset.sec));
						}}
						type="button"
					>
						{preset.label}
					</button>
				))}
			</div>

			<label className="mt-4 flex items-center justify-center gap-2 text-sm text-white/70">
				{isE2eFastDurationsEnabled()
					? `Custom (${MIN_CUSTOM_MINUTES}–90 min)`
					: "Custom (5–90 min)"}
				<input
					className={`w-16 rounded border bg-white/10 px-2 py-1 text-center text-white ${
						showCustomError
							? "border-red-400 outline outline-1 outline-red-400/50"
							: "border-white/20"
					}`}
					max={90}
					min={MIN_CUSTOM_MINUTES}
					onChange={(e) => setCustomMinutes(e.target.value)}
					type="number"
					value={customMinutes}
				/>
			</label>
			{showCustomError && (
				<p className="mt-1 text-center text-red-400 text-xs">
					{isE2eFastDurationsEnabled()
						? `Must be between ${MIN_CUSTOM_MINUTES} and 90 minutes`
						: "Must be between 5 and 90 minutes"}
				</p>
			)}

			<button
				className="mt-6 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
				disabled={isStarting || showCustomError}
				onClick={() => {
					const durationSec = usingPreset
						? selectedSec
						: customValid
							? customSec
							: selectedSec;
					void onStart(durationSec);
				}}
				type="button"
			>
				{isStarting ? "Starting..." : "Start Cycle"}
			</button>

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
						className="mt-3 flex flex-col gap-3"
						data-testid="break-settings-panel"
					>
						<label className="flex items-center justify-between text-sm text-white/70">
							Short break
							<div className="flex items-center gap-1">
								<input
									className="w-14 rounded border border-white/20 bg-white/10 px-2 py-1 text-center text-white"
									data-testid="short-break-input"
									max={30}
									min={1}
									onChange={(e) => {
										const val = Number.parseInt(e.target.value, 10);
										setShortBreakMin(val || 1);
										if (Number.isFinite(val) && val >= 1 && val <= 30) {
											setShortBreakDuration(val * 60);
										}
									}}
									type="number"
									value={shortBreakMin}
								/>
								<span className="text-white/50">min</span>
							</div>
						</label>
						<label className="flex items-center justify-between text-sm text-white/70">
							Long break
							<div className="flex items-center gap-1">
								<input
									className="w-14 rounded border border-white/20 bg-white/10 px-2 py-1 text-center text-white"
									data-testid="long-break-input"
									max={30}
									min={1}
									onChange={(e) => {
										const val = Number.parseInt(e.target.value, 10);
										setLongBreakMin(val || 1);
										if (Number.isFinite(val) && val >= 1 && val <= 30) {
											setLongBreakDuration(val * 60);
										}
									}}
									type="number"
									value={longBreakMin}
								/>
								<span className="text-white/50">min</span>
							</div>
						</label>
					</div>
				)}
			</div>
		</section>
	);
}
