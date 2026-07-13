"use client";

import { Calendar, ChevronRight, Coffee, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { DurationPicker } from "~/app/_components/duration-picker";
import { FocusWidgetCard } from "~/app/_components/focus-widget-card";
import {
	getLongBreakPresets,
	getMaxBreakDurationSec,
	getMinBreakDurationSec,
	getShortBreakPresets,
} from "~/lib/duration-bounds";
import {
	getLongBreakDuration,
	getShortBreakDuration,
} from "~/lib/duration-storage";

type QuickActionsProps = {
	onAddTask?: () => void;
	onStartBreak?: (
		kind: "SHORT_BREAK" | "LONG_BREAK",
		durationSec: number,
	) => Promise<void>;
	variant?: "inline" | "widget";
};

export function QuickActions({
	onAddTask,
	onStartBreak,
	variant = "widget",
}: QuickActionsProps) {
	const t = useTranslations("QuickActions");

	const [pickerOpen, setPickerOpen] = useState(false);
	const [breakKind, setBreakKind] = useState<"SHORT_BREAK" | "LONG_BREAK">(
		"SHORT_BREAK",
	);
	const [durationSec, setDurationSec] = useState(() => getShortBreakDuration());
	const [pickerInvalid, setPiclerInvalid] = useState(false);
	const [starting, setStarting] = useState(false);

	const handleBreakKindChange = useCallback(
		(kind: "SHORT_BREAK" | "LONG_BREAK") => {
			setBreakKind(kind);
			setDurationSec(
				kind === "SHORT_BREAK"
					? getShortBreakDuration()
					: getLongBreakDuration(),
			);
		},
		[],
	);

	const handleStartBreak = useCallback(async () => {
		if (!onStartBreak || pickerInvalid || starting) {
			return;
		}
		setStarting(true);
		try {
			await onStartBreak(breakKind, durationSec);
		} finally {
			setStarting(false);
			setPickerOpen(false);
		}
	}, [onStartBreak, breakKind, durationSec, pickerInvalid, starting]);

	const presets =
		breakKind === "SHORT_BREAK"
			? getShortBreakPresets()
			: getLongBreakPresets();
	const boundsLabel = `${Math.floor(getMinBreakDurationSec() / 60)}:${String(getMinBreakDurationSec() % 60).padStart(2, "0")}–${Math.floor(getMaxBreakDurationSec() / 60)}:00`;

	const breakPicker = pickerOpen ? (
		<div
			className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-card p-4"
			data-testid="ad-hoc-break-picker"
		>
			<div className="flex gap-2">
				<button
					aria-pressed={breakKind === "SHORT_BREAK"}
					className={`flex-1 rounded-control px-3 py-1.5 font-medium text-sm transition ${breakKind === "SHORT_BREAK" ? "bg-segment-active text-on-cta" : "bg-segment-inactive text-text-secondary hover:bg-surface-card-muted"}`}
					data-testid="ad-hoc-break-short"
					onClick={() => handleBreakKindChange("SHORT_BREAK")}
					type="button"
				>
					{t("shortBreak")}
				</button>
				<button
					aria-pressed={breakKind === "LONG_BREAK"}
					className={`flex-1 rounded-control px-3 py-1.5 font-medium text-sm transition ${breakKind === "LONG_BREAK" ? "bg-segment-active text-on-cta" : "bg-segment-inactive text-text-secondary hover:bg-surface-card-muted"}`}
					data-testid="ad-hoc-break-long"
					onClick={() => handleBreakKindChange("LONG_BREAK")}
					type="button"
				>
					{t("longBreak")}
				</button>
			</div>

			<DurationPicker
				boundsLabel={boundsLabel}
				maxSec={getMaxBreakDurationSec()}
				minSec={getMinBreakDurationSec()}
				onChangeSec={setDurationSec}
				onValidationChange={setPiclerInvalid}
				presets={[...presets]}
				testIdPrefix="ad-hoc-break-duration"
				valueSec={durationSec}
			/>

			<div className="flex gap-2">
				<button
					className="flex-1 rounded-control bg-segment-inactive px-3 py-2 font-medium text-sm text-text-secondary transition hover:bg-surface-card-muted"
					data-testid="ad-hoc-break-cancel"
					onClick={() => setPickerOpen(false)}
					type="button"
				>
					{t("cancel")}
				</button>
				<button
					className="flex-1 rounded-control bg-accent-cta px-3 py-2 font-medium text-on-cta text-sm transition hover:bg-accent-cta-hover disabled:opacity-50"
					data-testid="ad-hoc-break-confirm"
					disabled={pickerInvalid || starting}
					onClick={handleStartBreak}
					type="button"
				>
					{starting ? t("starting") : t("startBreakConfirm")}
				</button>
			</div>
		</div>
	) : null;

	const items = [
		{
			key: "addTask",
			label: t("addTask"),
			icon: Plus,
			onClick: onAddTask,
			testId: "quick-action-add-task",
		},
		...(onStartBreak
			? [
					{
						key: "startBreak",
						label: t("startBreak"),
						icon: Coffee,
						onClick: () => setPickerOpen(!pickerOpen),
						testId: "quick-action-start-break",
					},
				]
			: []),
		{
			key: "planDay",
			label: t("planDay"),
			icon: Calendar,
			href: "/plan" as const,
			testId: "quick-action-plan-day",
		},
	];

	const list = (
		<ul className="space-y-1">
			{items.map((item) => {
				const Icon = item.icon;
				const rowClass =
					"flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left text-sm transition hover:bg-surface-card-muted";

				const content = (
					<>
						<Icon aria-hidden="true" className="h-4 w-4 text-accent-cta" />
						<span className="flex-1 font-medium text-primary">
							{item.label}
						</span>
						<ChevronRight
							aria-hidden="true"
							className="h-4 w-4 text-text-dimmed"
						/>
					</>
				);

				return (
					<li key={item.key}>
						{"onClick" in item ? (
							<button
								className={rowClass}
								data-testid={item.testId}
								onClick={item.onClick}
								type="button"
							>
								{content}
							</button>
						) : (
							<Link
								className={rowClass}
								data-testid={item.testId}
								href={item.href}
							>
								{content}
							</Link>
						)}
					</li>
				);
			})}
			{breakPicker ? <li>{breakPicker}</li> : null}
		</ul>
	);

	if (variant === "inline") {
		return (
			<div className="flex w-full flex-col gap-2" data-testid="quick-actions">
				<div className="flex w-full flex-wrap gap-2">
					<button
						className="flex flex-1 items-center justify-center rounded-lg bg-accent-cta px-3 py-2 font-medium text-on-cta text-sm transition hover:bg-accent-cta-hover"
						data-testid="quick-action-add-task"
						onClick={onAddTask}
						type="button"
					>
						{t("addTask")}
					</button>
					{onStartBreak ? (
						<button
							className="flex flex-1 items-center justify-center rounded-lg bg-segment-inactive px-3 py-2 font-medium text-sm text-text-secondary transition hover:bg-surface-card-muted"
							data-testid="quick-action-start-break"
							onClick={() => setPickerOpen(!pickerOpen)}
							type="button"
						>
							{t("startBreak")}
						</button>
					) : null}
					<Link
						className="flex flex-1 items-center justify-center rounded-lg bg-segment-inactive px-3 py-2 font-medium text-sm text-text-secondary transition hover:bg-surface-card-muted"
						data-testid="quick-action-plan-day"
						href="/plan"
					>
						{t("planDay")}
					</Link>
				</div>
				{breakPicker}
			</div>
		);
	}

	return (
		<FocusWidgetCard
			icon={<Zap className="h-4 w-4 text-accent-cta" />}
			testId="quick-actions"
			title={t("heading")}
		>
			{list}
		</FocusWidgetCard>
	);
}
