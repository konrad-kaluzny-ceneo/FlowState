"use client";

import { CheckCircle, Pause, Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type {
	CycleKind,
	FocusedTask,
	PomodoroCycleState,
} from "~/hooks/use-pomodoro-cycle";
import {
	getMaxWorkDurationSec,
	getMinWorkDurationSec,
	getWorkDurationPresets,
} from "~/lib/duration-bounds";
import { isDurationSecInRange } from "~/lib/duration-input";
import { getLastDuration } from "~/lib/duration-storage";
import { formatRemainingMs } from "~/lib/format-remaining";

import { DurationPicker } from "./duration-picker";
import { OutOfTabBreakAlertsControl } from "./out-of-tab-break-alerts-control";
import { ProgressRing } from "./ui/progress-ring";

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
	configuredDurationSec?: number | null;
	preferredWorkDurationSec?: number | null;
	onWorkDurationManualChange?: () => void;
	outOfTabBreakAlertsEnabled?: boolean;
	onOutOfTabBreakAlertsChange?: (enabled: boolean) => void;
	onCompleteFocusedTask?: () => void;
	isCompletingFocusedTask?: boolean;
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
	configuredDurationSec = null,
	preferredWorkDurationSec = null,
	onWorkDurationManualChange,
	outOfTabBreakAlertsEnabled = true,
	onOutOfTabBreakAlertsChange,
	onCompleteFocusedTask,
	isCompletingFocusedTask = false,
}: TimerPanelProps) {
	const t = useTranslations("Timer");
	const [workDurationSec, setWorkDurationSec] = useState(
		() => preferredWorkDurationSec ?? getLastDuration(),
	);
	const [workPickerInvalid, setWorkPickerInvalid] = useState(false);

	useEffect(() => {
		if (preferredWorkDurationSec != null) {
			setWorkDurationSec(preferredWorkDurationSec);
		}
	}, [preferredWorkDurationSec]);

	const workMinSec = getMinWorkDurationSec();
	const workMaxSec = getMaxWorkDurationSec();

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
			cycleKind === "LONG_BREAK" ? t("breakLong") : t("breakShort");
		const isPaused = state === "paused";
		const configuredDurationMs =
			configuredDurationSec != null ? configuredDurationSec * 1000 : null;
		const ringProgress =
			configuredDurationMs != null && configuredDurationMs > 0
				? (configuredDurationMs - remainingMs) / configuredDurationMs
				: 0;

		return (
			<section
				aria-label={isBreak ? t("sectionBreakAria") : t("sectionFocusAria")}
				className={`w-full rounded-card border p-6 text-center shadow-sm ${
					isBreak
						? "border-border-break bg-surface-break"
						: "border-card-border bg-surface-card"
				}`}
				data-testid={isPaused ? "timer-panel-paused" : "timer-panel-running"}
			>
				<p
					className="font-semibold text-sm text-text-section"
					data-testid="timer-phase-label"
				>
					{isPaused
						? isBreak
							? t("statusBreakPaused")
							: t("statusPaused")
						: isBreak
							? breakLabel
							: t("statusFocusingOn")}
				</p>
				{!isBreak && (
					<div className="mt-1 flex items-center justify-center gap-3">
						<p className="font-semibold text-primary text-xl">
							{focusedTask?.title ?? t("focusedTaskFallback")}
						</p>
						{onCompleteFocusedTask != null && !isPaused && (
							<button
								aria-label={t("completeFocusedTaskAria")}
								className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent-success/30 bg-accent-success/10 px-2.5 py-1 text-accent-success transition hover:border-accent-success/50 hover:bg-accent-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
								data-testid="focus-complete-focused-task"
								disabled={isCompletingFocusedTask}
								onClick={onCompleteFocusedTask}
								type="button"
							>
								<CheckCircle aria-hidden="true" className="h-4 w-4" />
								<span className="font-semibold text-xs">
									{t("completeFocusedTaskLabel")}
								</span>
							</button>
						)}
					</div>
				)}
				<div className="mt-4 flex justify-center">
					<ProgressRing
						progress={ringProgress}
						progressClassName={
							isBreak ? "stroke-accent-break" : "stroke-accent-cta"
						}
					>
						<p
							className={`font-mono font-semibold text-timer tabular-nums tracking-tight ${
								isBreak ? "text-accent-break" : "text-primary"
							}`}
							data-testid="timer-countdown"
						>
							{formatRemainingMs(remainingMs)}
						</p>
					</ProgressRing>
				</div>
				{isPaused ? (
					<button
						aria-label={isBreak ? t("resumeBreakAria") : t("resumeAria")}
						className="mt-6 flex w-full items-center justify-center rounded-control bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
						data-testid="timer-resume"
						onClick={() => void onResume()}
						type="button"
					>
						<Play aria-hidden="true" className="h-5 w-5" />
					</button>
				) : (
					<div className="mt-6 flex flex-col gap-3">
						<button
							aria-label={isBreak ? t("pauseBreakAria") : t("pauseAria")}
							className="flex w-full items-center justify-center rounded-control bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
							data-testid="timer-pause"
							onClick={() => void onPause()}
							type="button"
						>
							<Pause aria-hidden="true" className="h-5 w-5" />
						</button>
						<button
							aria-label={isBreak ? t("endBreakEarlyAria") : t("interruptAria")}
							className="flex w-full items-center justify-center rounded-control bg-danger px-4 py-2 font-semibold text-on-danger transition hover:bg-danger-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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

	const startLabel =
		focusedTask != null
			? t("startCycleForTask", { title: focusedTask.title })
			: t("startCycleAria");

	return (
		<section
			aria-label={t("sectionReadyAria")}
			className="w-full rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
			data-testid="timer-panel-idle"
		>
			<p className="text-center font-semibold text-sm text-text-section">
				{t("idleReadyToFocusOn")}
			</p>
			<p className="text-center font-semibold text-primary text-xl">
				{focusedTask?.title}
			</p>

			<p className="mt-4 text-center text-sm text-text-secondary">
				{t("idleWorkDuration")}
			</p>
			<DurationPicker
				boundsLabel={t("boundsWork")}
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
				aria-label={startLabel}
				className="mt-6 w-full rounded-control bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover disabled:opacity-50"
				data-testid="timer-start-cycle"
				disabled={isStarting || workPickerInvalid || !workValid}
				onClick={() => void onStart(workDurationSec)}
				type="button"
			>
				<span aria-hidden="true">
					{isStarting ? t("starting") : t("startLabel")}
				</span>
			</button>
		</section>
	);
}
