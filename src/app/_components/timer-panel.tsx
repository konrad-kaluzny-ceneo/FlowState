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

function presetToCustomSec(sec: number): string {
	return String(sec);
}

function initialDurationState() {
	const sec = getLastDuration();
	return {
		selectedSec: sec,
		customSec: presetToCustomSec(sec),
	};
}

function parseCustomSecInput(value: string): number | null {
	if (value.trim() === "") {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
		return null;
	}
	return parsed;
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
	const [customSec, setCustomSec] = useState(
		() => initialDurationState().customSec,
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

	const parsedCustomSec = parseCustomSecInput(customSec);
	const customValid =
		parsedCustomSec != null &&
		parsedCustomSec >= MIN_CUSTOM_DURATION_SEC &&
		parsedCustomSec <= MAX_DURATION_SEC;
	const presetMatch =
		parsedCustomSec != null
			? DURATION_PRESETS_SEC.find((p) => p.sec === parsedCustomSec)
			: undefined;
	const usingPreset = presetMatch != null && selectedSec === presetMatch.sec;
	const customTouched =
		customSec !== "" && (parsedCustomSec == null || presetMatch == null);
	const showCustomError = customTouched && !customValid;

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
							usingPreset && presetMatch?.sec === preset.sec
								? "bg-purple-600 text-white"
								: "bg-white/10 text-white/80 hover:bg-white/20"
						}`}
						key={preset.sec}
						onClick={() => {
							setSelectedSec(preset.sec);
							setCustomSec(presetToCustomSec(preset.sec));
						}}
						type="button"
					>
						{preset.label}
					</button>
				))}
			</div>

			<label className="mt-4 flex flex-col items-center gap-1 text-sm text-white/70">
				<span>Custom (1–{MAX_DURATION_SEC} sec, 90 min max)</span>
				<input
					className={`w-24 rounded border bg-white/10 px-2 py-1 text-center text-white ${
						showCustomError
							? "border-red-400 outline-1 outline-red-400/50"
							: "border-white/20"
					}`}
					data-testid="work-duration-custom-sec"
					max={MAX_DURATION_SEC}
					min={MIN_CUSTOM_DURATION_SEC}
					onChange={(e) => {
						const next = e.target.value;
						setCustomSec(next);
						const parsed = parseCustomSecInput(next);
						if (
							parsed != null &&
							DURATION_PRESETS_SEC.some((p) => p.sec === parsed)
						) {
							setSelectedSec(parsed);
						}
					}}
					type="number"
					value={customSec}
				/>
			</label>
			{showCustomError && (
				<p className="mt-1 text-center text-red-400 text-xs">
					Must be between {MIN_CUSTOM_DURATION_SEC} and {MAX_DURATION_SEC}{" "}
					seconds
				</p>
			)}

			<button
				className="mt-6 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
				disabled={isStarting || showCustomError}
				onClick={() => {
					const durationSec = usingPreset
						? selectedSec
						: customValid && parsedCustomSec != null
							? parsedCustomSec
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
