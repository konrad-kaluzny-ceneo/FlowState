"use client";

import { useState } from "react";

import type {
	FocusedTask,
	PomodoroCycleState,
} from "~/hooks/use-pomodoro-cycle";
import {
	getLastDuration,
	getLongBreakDuration,
	getShortBreakDuration,
	setLongBreakDuration,
	setShortBreakDuration,
} from "~/lib/duration-storage";
import { formatRemainingMs } from "~/lib/format-remaining";

const DURATION_PRESETS_SEC = [
	{ label: "15 min", sec: 15 * 60 },
	{ label: "25 min", sec: 25 * 60 },
	{ label: "45 min", sec: 45 * 60 },
	{ label: "60 min", sec: 60 * 60 },
] as const;

const MIN_DURATION_SEC = 5 * 60;
const MAX_DURATION_SEC = 90 * 60;

function initialDurationState() {
	const sec = getLastDuration();
	return {
		selectedSec: sec,
		customMinutes: String(Math.round(sec / 60)),
	};
}

type TimerPanelProps = {
	state: PomodoroCycleState;
	remainingMs: number;
	focusedTask: FocusedTask;
	onStart: (durationSec: number) => Promise<void>;
	onInterrupt: () => Promise<void>;
	isStarting?: boolean;
};

export function TimerPanel({
	state,
	remainingMs,
	focusedTask,
	onStart,
	onInterrupt,
	isStarting = false,
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

	if (focusedTask == null && state !== "running") {
		return null;
	}

	if (state === "completed") {
		return null;
	}

	if (state === "running") {
		return (
			<section
				className="w-full max-w-lg rounded-xl border border-white/20 bg-white/10 p-6 text-center"
				data-testid="timer-panel-running"
			>
				<p className="text-sm text-white/60">Focusing on</p>
				<p className="mt-1 font-medium text-lg text-white">
					{focusedTask?.title ?? "Task"}
				</p>
				<p
					className="mt-4 font-bold font-mono text-6xl tabular-nums tracking-tight"
					data-testid="timer-countdown"
				>
					{formatRemainingMs(remainingMs)}
				</p>
				<button
					className="mt-6 rounded-lg border border-white/30 px-4 py-2 text-sm text-white/80 transition hover:border-red-400/60 hover:text-red-300"
					onClick={() => void onInterrupt()}
					type="button"
				>
					Interrupt
				</button>
			</section>
		);
	}

	const customSec = Number.parseInt(customMinutes, 10) * 60;
	const customValid =
		Number.isFinite(customSec) &&
		customSec >= MIN_DURATION_SEC &&
		customSec <= MAX_DURATION_SEC;

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
							setCustomMinutes(String(preset.sec / 60));
						}}
						type="button"
					>
						{preset.label}
					</button>
				))}
			</div>

			<label className="mt-4 flex items-center justify-center gap-2 text-sm text-white/70">
				Custom (5–90 min)
				<input
					className="w-16 rounded border border-white/20 bg-white/10 px-2 py-1 text-center text-white"
					max={90}
					min={5}
					onChange={(e) => setCustomMinutes(e.target.value)}
					type="number"
					value={customMinutes}
				/>
			</label>

			<button
				className="mt-6 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
				disabled={isStarting}
				onClick={() => {
					const durationSec = customValid ? customSec : selectedSec;
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
