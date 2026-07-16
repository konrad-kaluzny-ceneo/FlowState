"use client";

import { useLocale, useTranslations } from "next-intl";

import { ComingSoonPreview } from "~/app/_components/ui/coming-soon-preview";
import {
	getWorkTypeLabel,
	WORK_TYPE_CONFIG,
	type WorkTypeKey,
} from "~/lib/design/work-type-config";
import type { UserLocale } from "~/lib/domain/user-locale";
import type { DayStats, HourBucket } from "~/lib/recap/aggregate-day-stats";
import { filterCompletedRecapRows } from "~/lib/recap/filter-completed-recap-rows";
import type { RecapTaskRow } from "~/lib/recap/types";

// ─── KPI card ─────────────────────────────────────────────────────────────────

type KpiCardProps = {
	label: string;
	value: string;
	/** Progress 0–1 for the green bar (omit to hide the bar). */
	progress?: number;
};

function KpiCard({ label, value, progress }: KpiCardProps) {
	return (
		<div className="flex flex-col gap-1 rounded-card border border-card-border bg-surface-card px-4 py-3 shadow-sm">
			<span className="text-text-secondary text-xs">{label}</span>
			<span className="font-semibold text-primary text-xl tabular-nums">
				{value}
			</span>
			{progress != null && (
				<div
					aria-hidden="true"
					className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-segment-inactive"
				>
					<div
						className="h-full rounded-full bg-accent-cta transition-[width]"
						style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }}
					/>
				</div>
			)}
		</div>
	);
}

// ─── Hourly bar chart (pure SVG, no lib dependency) ──────────────────────────

const CHART_HEIGHT = 80;
const CHART_WIDTH = 288; // reference width; scales via viewBox
const BAR_PADDING = 1;
const BAR_WIDTH = CHART_WIDTH / 24 - BAR_PADDING;

type HourlyChartProps = {
	buckets: HourBucket[];
	ariaLabel: string;
};

function HourlyBarChart({ buckets, ariaLabel }: HourlyChartProps) {
	const max = Math.max(...buckets.map((b) => b.focusMinutes), 1);

	return (
		<svg
			aria-label={ariaLabel}
			className="w-full"
			preserveAspectRatio="none"
			role="img"
			style={{ height: CHART_HEIGHT }}
			viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
		>
			{buckets.map((bucket, i) => {
				const barH = Math.round(
					(bucket.focusMinutes / max) * (CHART_HEIGHT - 4),
				);
				const x = i * (BAR_WIDTH + BAR_PADDING);
				const y = CHART_HEIGHT - barH;
				return (
					<rect
						className={
							barH > 0 ? "fill-accent-cta opacity-80" : "fill-segment-inactive"
						}
						height={Math.max(barH, 2)}
						key={bucket.hour}
						rx={2}
						width={BAR_WIDTH}
						x={x}
						y={barH > 0 ? y : CHART_HEIGHT - 2}
					/>
				);
			})}
		</svg>
	);
}

// ─── Hour axis labels (0, 6, 12, 18) ─────────────────────────────────────────

function HourAxisLabels() {
	const labels = [0, 6, 12, 18];
	return (
		<div aria-hidden="true" className="relative flex w-full justify-between">
			{labels.map((h) => (
				<span className="text-text-dimmed text-xs" key={h}>
					{h}:00
				</span>
			))}
		</div>
	);
}

// ─── Donut chart (SVG ring slices) ────────────────────────────────────────────

type DonutSlice = {
	label: string;
	value: number;
	colorClass: string;
};

type DonutChartProps = {
	slices: DonutSlice[];
	ariaLabel: string;
	size?: number;
};

const DONUT_COLORS: Record<string, string> = {
	DEEP_WORK: "stroke-accent-cta",
	OPERATIONAL: "stroke-accent-break",
	REACTIVE: "stroke-accent-success",
	uncategorized: "stroke-border-subtle",
	done: "stroke-accent-cta",
	partial: "stroke-accent-break",
	undone: "stroke-segment-inactive",
};

function DonutChart({ slices, ariaLabel, size = 96 }: DonutChartProps) {
	const total = slices.reduce((s, sl) => s + sl.value, 0);
	if (total === 0) {
		return (
			<svg
				aria-label={ariaLabel}
				height={size}
				role="img"
				viewBox={`0 0 ${size} ${size}`}
				width={size}
			>
				<circle
					className="stroke-segment-inactive"
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={(size - 16) / 2}
					strokeWidth={12}
				/>
			</svg>
		);
	}

	const r = (size - 16) / 2;
	const cx = size / 2;
	const cy = size / 2;
	const circumference = 2 * Math.PI * r;

	let cumulativeFraction = 0;

	return (
		<svg
			aria-label={ariaLabel}
			className="-rotate-90 transform"
			height={size}
			role="img"
			viewBox={`0 0 ${size} ${size}`}
			width={size}
		>
			{slices.map((slice) => {
				const fraction = slice.value / total;
				const dashArray = `${fraction * circumference} ${circumference}`;
				const dashOffset = -cumulativeFraction * circumference;
				cumulativeFraction += fraction;

				return (
					<circle
						className={slice.colorClass}
						cx={cx}
						cy={cy}
						fill="none"
						key={slice.label}
						r={r}
						strokeDasharray={dashArray}
						strokeDashoffset={dashOffset}
						strokeWidth={12}
					/>
				);
			})}
		</svg>
	);
}

// ─── Legend row ───────────────────────────────────────────────────────────────

type LegendRowProps = {
	colorClass: string;
	label: string;
	value: number;
	total: number;
	unit?: string;
};

function LegendRow({ colorClass, label, value, total, unit }: LegendRowProps) {
	const pct = total > 0 ? Math.round((value / total) * 100) : 0;
	return (
		<div className="flex items-center gap-2">
			<span
				className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${colorClass.replace("stroke-", "bg-")}`}
			/>
			<span className="min-w-0 flex-1 truncate text-text-secondary text-xs">
				{label}
			</span>
			<span className="font-medium text-primary text-xs tabular-nums">
				{unit != null ? unit : `${pct}%`}
			</span>
		</div>
	);
}

// ─── Completed task row ───────────────────────────────────────────────────────

type CompletedTaskRowProps = {
	row: RecapTaskRow;
	locale: UserLocale;
	tPodsumowanie: ReturnType<typeof useTranslations<"Podsumowanie">>;
	tTasks: ReturnType<typeof useTranslations<"Tasks">>;
};

function CompletedTaskRow({
	row,
	locale,
	tPodsumowanie,
	tTasks,
}: CompletedTaskRowProps) {
	const config = WORK_TYPE_CONFIG[row.workType as WorkTypeKey];
	const timeLabel =
		row.effortMinutes != null
			? tTasks("effortMinutes", { minutes: row.effortMinutes })
			: tPodsumowanie("kpiMinutes", { minutes: row.focusedMinutes });

	return (
		<li
			className="rounded-card border border-card-border bg-surface-card px-4 py-3 shadow-sm"
			data-testid={`podsumowanie-completed-row-${row.taskId}`}
		>
			<p className="font-medium text-primary text-sm">{row.title}</p>
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				<span
					className={`rounded-full px-2.5 py-1 font-semibold text-xs ring-1 ${config.bg} ${config.text} ${config.badgeRing}`}
					data-testid="completed-task-type-badge"
				>
					{getWorkTypeLabel(row.workType as WorkTypeKey, locale)}
				</span>
				<span
					className="rounded-full border border-border-subtle bg-surface-panel px-2.5 py-1 font-medium text-text-secondary text-xs"
					data-testid="completed-task-time-badge"
				>
					{timeLabel}
				</span>
			</div>
		</li>
	);
}

type CompletedTasksSectionProps = {
	rows: RecapTaskRow[];
	locale: UserLocale;
	tPodsumowanie: ReturnType<typeof useTranslations<"Podsumowanie">>;
	tTasks: ReturnType<typeof useTranslations<"Tasks">>;
};

function CompletedTasksSection({
	rows,
	locale,
	tPodsumowanie,
	tTasks,
}: CompletedTasksSectionProps) {
	return (
		<section
			className="rounded-card border border-card-border bg-surface-card px-4 py-4 shadow-sm"
			data-testid="podsumowanie-completed-list"
		>
			<h3 className="mb-3 font-medium text-primary text-sm">
				{tPodsumowanie("completedListTitle")}
			</h3>
			{rows.length === 0 ? (
				<p
					className="text-center text-sm text-text-secondary"
					data-testid="podsumowanie-completed-empty"
				>
					{tPodsumowanie("completedListEmpty")}
				</p>
			) : (
				<ul className="space-y-2">
					{rows.map((row) => (
						<CompletedTaskRow
							key={String(row.taskId)}
							locale={locale}
							row={row}
							tPodsumowanie={tPodsumowanie}
							tTasks={tTasks}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

// ─── Work-type label map (translation keys) ───────────────────────────────────

const WORK_TYPE_LABEL_KEY: Record<string, string> = {
	DEEP_WORK: "workTypeDeep",
	OPERATIONAL: "workTypeOperational",
	REACTIVE: "workTypeReactive",
	uncategorized: "workTypeUncategorized",
};

// ─── Main view ────────────────────────────────────────────────────────────────

export type PodsumowanieViewProps = {
	stats: DayStats | null;
	last24Hours?: RecapTaskRow[];
	isLoading?: boolean;
	isGuest?: boolean;
};

export function PodsumowanieView({
	stats,
	last24Hours = [],
	isLoading = false,
	isGuest = false,
}: PodsumowanieViewProps) {
	const t = useTranslations("Podsumowanie");
	const tTasks = useTranslations("Tasks");
	const locale = useLocale() as UserLocale;
	const completedTasks = filterCompletedRecapRows(last24Hours);

	const workTypeLabel = (wt: string) => {
		const key = WORK_TYPE_LABEL_KEY[wt] ?? "workTypeUncategorized";
		return t(key as Parameters<typeof t>[0]);
	};

	if (isGuest && stats == null) {
		return (
			<div
				className="w-full max-w-lg space-y-4"
				data-testid="podsumowanie-view"
			>
				<div>
					<h2 className="font-semibold text-lg text-text-section">
						{t("title")}
					</h2>
					<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
				</div>
				<div
					className="rounded-card border border-card-border bg-surface-card px-4 py-3 shadow-sm"
					data-testid="podsumowanie-guest-empty"
				>
					<p className="text-sm text-text-secondary">{t("guestEmpty")}</p>
				</div>
			</div>
		);
	}

	if (isLoading || stats == null) {
		return (
			<div
				className="w-full max-w-lg space-y-4"
				data-testid="podsumowanie-view"
			>
				<div>
					<h2 className="font-semibold text-lg text-text-section">
						{t("title")}
					</h2>
					<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
				</div>
				<p
					className="text-sm text-text-dimmed"
					data-testid="podsumowanie-loading"
				>
					{t("loading")}
				</p>
			</div>
		);
	}

	// ── KPI values ─────────────────────────────────────────────────────────────
	const maxGoalMinutes = 240; // 4h reference for progress bar
	const focusProgress = stats.focusMinutes / maxGoalMinutes;

	// ── Session-type donut slices ───────────────────────────────────────────────
	const workTypeSlices: DonutSlice[] = stats.workTypeStats.map((wt) => ({
		label: workTypeLabel(wt.workType),
		value: wt.focusMinutes,
		colorClass: DONUT_COLORS[wt.workType] ?? "stroke-border-subtle",
	}));

	const totalWorkTypeMinutes = stats.workTypeStats.reduce(
		(s, wt) => s + wt.focusMinutes,
		0,
	);

	// ── Tasks donut slices ──────────────────────────────────────────────────────
	const { done, partial, undone } = stats.taskCompletionStat;
	const taskSlices: DonutSlice[] = [
		{ label: "done", value: done, colorClass: DONUT_COLORS.done ?? "" },
		{
			label: "partial",
			value: partial,
			colorClass: DONUT_COLORS.partial ?? "",
		},
		{ label: "undone", value: undone, colorClass: DONUT_COLORS.undone ?? "" },
	];
	const totalTasks = done + partial + undone;

	const hasAnyData = stats.sessionCount > 0 || stats.doneTasksCount > 0;

	return (
		<div className="w-full max-w-2xl space-y-6" data-testid="podsumowanie-view">
			{/* Header */}
			<div>
				<h2 className="font-semibold text-lg text-text-section">
					{t("title")}
				</h2>
				<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
			</div>

			{/* No data state */}
			{!hasAnyData ? (
				<div
					className="rounded-card border border-card-border bg-surface-card px-6 py-8 text-center shadow-sm"
					data-testid="podsumowanie-no-data"
				>
					<p className="font-medium text-primary">{t("noDataTitle")}</p>
					<p className="mt-1 text-sm text-text-secondary">{t("noDataBody")}</p>
				</div>
			) : (
				<>
					{/* KPI grid */}
					<div
						className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
						data-testid="podsumowanie-kpis"
					>
						<KpiCard
							label={t("kpiTasksDone")}
							value={String(stats.doneTasksCount)}
						/>
						<KpiCard
							label={t("kpiFocusTime")}
							progress={focusProgress}
							value={t("kpiMinutes", { minutes: stats.focusMinutes })}
						/>
						<KpiCard
							label={t("kpiBreakTime")}
							value={t("kpiMinutes", { minutes: stats.breakMinutes })}
						/>
						<KpiCard
							label={t("kpiSessions")}
							value={String(stats.sessionCount)}
						/>
						<KpiCard
							label={t("kpiAvgSession")}
							value={
								stats.avgSessionMinutes > 0
									? t("kpiMinutes", { minutes: stats.avgSessionMinutes })
									: "—"
							}
						/>
					</div>

					{/* Hourly bar chart */}
					<div
						className="rounded-card border border-card-border bg-surface-card px-4 py-4 shadow-sm"
						data-testid="podsumowanie-hourly-chart"
					>
						<p className="mb-3 font-medium text-primary text-sm">
							{t("hourlyChartTitle")}
						</p>
						<HourlyBarChart
							ariaLabel={t("hourlyChartAria")}
							buckets={stats.hourBuckets}
						/>
						<div className="mt-1">
							<HourAxisLabels />
						</div>
					</div>

					{/* Donuts row */}
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{/* Session-type donut */}
						<div
							className="rounded-card border border-card-border bg-surface-card px-4 py-4 shadow-sm"
							data-testid="podsumowanie-session-type-donut"
						>
							<p className="mb-3 font-medium text-primary text-sm">
								{t("sessionTypeTitle")}
							</p>
							{workTypeSlices.length === 0 ? (
								<p className="text-text-dimmed text-xs">{t("noDataBody")}</p>
							) : (
								<div className="flex items-center gap-4">
									<div className="flex-shrink-0">
										<DonutChart
											ariaLabel={t("sessionTypeAria")}
											slices={workTypeSlices}
										/>
									</div>
									<div className="flex min-w-0 flex-1 flex-col gap-1.5">
										{stats.workTypeStats.map((wt) => (
											<LegendRow
												colorClass={
													DONUT_COLORS[wt.workType] ?? "stroke-border-subtle"
												}
												key={wt.workType}
												label={workTypeLabel(wt.workType)}
												total={totalWorkTypeMinutes}
												value={wt.focusMinutes}
											/>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Tasks donut */}
						<div
							className="rounded-card border border-card-border bg-surface-card px-4 py-4 shadow-sm"
							data-testid="podsumowanie-task-donut"
						>
							<p className="mb-3 font-medium text-primary text-sm">
								{t("taskBreakdownTitle")}
							</p>
							{totalTasks === 0 ? (
								<p className="text-text-dimmed text-xs">{t("noDataBody")}</p>
							) : (
								<div className="flex items-center gap-4">
									<div className="flex-shrink-0">
										<DonutChart
											ariaLabel={t("taskBreakdownAria")}
											slices={taskSlices.filter((s) => s.value > 0)}
										/>
									</div>
									<div className="flex min-w-0 flex-1 flex-col gap-1.5">
										{done > 0 && (
											<LegendRow
												colorClass={DONUT_COLORS.done ?? ""}
												label={t("taskDone")}
												total={totalTasks}
												value={done}
											/>
										)}
										{partial > 0 && (
											<LegendRow
												colorClass={DONUT_COLORS.partial ?? ""}
												label={t("taskPartial")}
												total={totalTasks}
												value={partial}
											/>
										)}
										{undone > 0 && (
											<LegendRow
												colorClass={DONUT_COLORS.undone ?? ""}
												label={t("taskUndone")}
												total={totalTasks}
												value={undone}
											/>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</>
			)}

			<CompletedTasksSection
				locale={locale}
				rows={completedTasks}
				tPodsumowanie={t}
				tTasks={tTasks}
			/>

			{/* Deferred widgets */}
			<div
				className="grid grid-cols-1 gap-3 sm:grid-cols-2"
				data-testid="podsumowanie-deferred"
			>
				<div className="space-y-2">
					<p className="font-medium text-primary text-sm">
						{t("bestTimeTitle")}
					</p>
					<ComingSoonPreview
						label={t("bestTimeComingSoon")}
						testId="podsumowanie-best-time-preview"
					>
						<div className="space-y-2 p-4">
							<div className="h-3 w-3/4 rounded bg-segment-inactive" />
							<div className="h-20 rounded bg-accent-cta/20" />
							<div className="h-3 w-1/2 rounded bg-segment-inactive" />
						</div>
					</ComingSoonPreview>
				</div>
				<div className="flex items-end">
					<ComingSoonPreview
						label={t("dateNavComingSoon")}
						testId="podsumowanie-date-nav-preview"
					>
						<div className="flex items-center justify-between gap-2 p-4">
							<div className="h-8 w-8 rounded-full bg-segment-inactive" />
							<div className="h-4 w-24 rounded bg-segment-inactive" />
							<div className="h-8 w-8 rounded-full bg-segment-inactive" />
						</div>
					</ComingSoonPreview>
				</div>
			</div>

			{/* Summary footer hero band */}
			<div
				className="summary-footer-hero flex min-h-24 w-full items-center px-6 py-6 sm:min-h-32"
				data-testid="podsumowanie-footer-hero"
			>
				<div className="max-w-md">
					<p className="font-semibold text-primary text-sm sm:text-base">
						{t("footerBannerTitle")}
					</p>
					<p className="mt-1 text-sm text-text-secondary">
						{t("footerBannerBody")}
					</p>
				</div>
			</div>
		</div>
	);
}
