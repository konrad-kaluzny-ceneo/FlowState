"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { DayScheduleTimeline } from "~/app/_components/day-schedule-timeline";
import { DelegationSuggestionCard } from "~/app/_components/delegation-suggestion-card";
import { FocusBudgetPrompt } from "~/app/_components/focus-budget-prompt";
import type { useDayPlan } from "~/hooks/use-day-plan";
import type { useDaySchedule } from "~/hooks/use-day-schedule";
import { useDelegationSuggestion } from "~/hooks/use-delegation-suggestion";
import { useTaskMutations } from "~/hooks/use-task-mutations";
import { formatFocusMinutes } from "~/lib/time/format-focus-minutes";
import { api } from "~/trpc/react";

const PRESET_HOURS_MINUTES = [120, 240, 360] as const;

type PlanDniaViewProps = {
	dayPlan: ReturnType<typeof useDayPlan> | undefined;
	daySchedule?: ReturnType<typeof useDaySchedule>;
};

function BudgetPanel({
	dayPlan,
}: {
	dayPlan: NonNullable<PlanDniaViewProps["dayPlan"]>;
}) {
	const t = useTranslations("PlanDnia");
	const [editing, setEditing] = useState(false);
	const [customMinutes, setCustomMinutes] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSetBudget = useCallback(
		async (minutes: number) => {
			setError(null);
			try {
				await dayPlan.setBudget(minutes);
				setEditing(false);
				setCustomMinutes("");
			} catch {
				setError(t("saveError"));
			}
		},
		[dayPlan, t],
	);

	const handleCustomSubmit = useCallback(async () => {
		const parsed = Number.parseInt(customMinutes.trim(), 10);
		if (!Number.isFinite(parsed) || parsed < 15 || parsed > 720) {
			setError(t("validationError"));
			return;
		}
		await handleSetBudget(parsed);
	}, [customMinutes, handleSetBudget, t]);

	return (
		<div
			className="w-full rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm"
			data-testid="plan-dnia-summary"
		>
			<p className="font-medium text-primary text-sm">{t("budgetHeading")}</p>
			<p className="mt-2 text-text-secondary text-xs">
				{t("budgetLine", {
					used: formatFocusMinutes(dayPlan.usedMinutes),
					budget: formatFocusMinutes(dayPlan.budgetMinutes ?? 0),
					remaining: formatFocusMinutes(dayPlan.remainingMinutes ?? 0),
				})}
			</p>
			<div
				aria-hidden="true"
				className="mt-2 h-2 w-full overflow-hidden rounded-full bg-segment-inactive"
			>
				<div
					className="h-full rounded-full bg-accent-cta transition-[width]"
					style={{
						width: `${Math.min(
							100,
							Math.round(
								((dayPlan.usedMinutes ?? 0) /
									Math.max(1, dayPlan.budgetMinutes ?? 1)) *
									100,
							),
						)}%`,
					}}
				/>
			</div>

			{editing ? (
				<div className="mt-4 space-y-3" data-testid="plan-dnia-editor">
					<div className="flex flex-wrap gap-2">
						{PRESET_HOURS_MINUTES.map((minutes) => (
							<button
								className="rounded-lg bg-segment-inactive px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-card-muted disabled:opacity-50"
								data-testid={`plan-dnia-preset-${minutes}`}
								disabled={dayPlan.isSettingBudget}
								key={minutes}
								onClick={() => void handleSetBudget(minutes)}
								type="button"
							>
								{t("presetLabel", { hours: minutes / 60 })}
							</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							aria-label={t("customAria")}
							className="w-24 rounded-md bg-surface-card px-2 py-1 text-primary text-xs placeholder:text-text-dimmed focus:outline-none"
							inputMode="numeric"
							max={720}
							min={15}
							onChange={(event) => {
								setCustomMinutes(event.target.value);
								setError(null);
							}}
							placeholder={t("customPlaceholder")}
							type="number"
							value={customMinutes}
						/>
						<button
							className="rounded-lg bg-accent-cta px-3 py-1.5 font-medium text-on-cta text-xs transition hover:bg-accent-cta-hover disabled:opacity-50"
							data-testid="plan-dnia-set-btn"
							disabled={dayPlan.isSettingBudget || customMinutes.trim() === ""}
							onClick={() => void handleCustomSubmit()}
							type="button"
						>
							{t("set")}
						</button>
						<button
							className="text-text-dimmed text-xs hover:text-text-section"
							data-testid="plan-dnia-cancel-btn"
							onClick={() => {
								setEditing(false);
								setError(null);
								setCustomMinutes("");
							}}
							type="button"
						>
							{t("cancel")}
						</button>
					</div>
				</div>
			) : (
				<button
					className="mt-3 rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-card-muted"
					data-testid="plan-dnia-change-btn"
					onClick={() => setEditing(true)}
					type="button"
				>
					{t("changeBudget")}
				</button>
			)}

			{error != null && (
				<p className="mt-2 text-red-300 text-xs" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

function DelegationSuggestionSection() {
	const delegation = useDelegationSuggestion();
	const { updateTask } = useTaskMutations();
	const [isAccepting, setIsAccepting] = useState(false);
	const utils = api.useUtils();

	const handleAccept = useCallback(async () => {
		if (delegation.candidate == null) {
			return;
		}
		setIsAccepting(true);
		try {
			await updateTask({ id: delegation.candidate.id, status: "delegated" });
			await utils.dayPlan.getDelegationSuggestion.invalidate({
				localDateKey: delegation.localDateKey,
			});
		} finally {
			setIsAccepting(false);
		}
	}, [delegation.candidate, delegation.localDateKey, updateTask, utils]);

	if (
		delegation.status !== "ready" ||
		delegation.candidate == null ||
		delegation.rationale == null
	) {
		const fallbackStatus =
			delegation.status === "ready" ? "empty" : delegation.status;
		return <DelegationSuggestionCard status={fallbackStatus} />;
	}

	return (
		<DelegationSuggestionCard
			isAccepting={isAccepting}
			isSkipping={delegation.isSkipping}
			onAccept={() => void handleAccept()}
			onSkip={() => void delegation.skip()}
			rationale={delegation.rationale}
			status="ready"
			taskTitle={delegation.candidate.title}
		/>
	);
}

export function PlanDniaView({ dayPlan, daySchedule }: PlanDniaViewProps) {
	const t = useTranslations("PlanDnia");

	return (
		<div className="w-full space-y-section" data-testid="plan-dnia-view">
			<div>
				<h2 className="font-semibold text-lg text-text-section">
					{t("title")}
				</h2>
				<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
			</div>

			{dayPlan != null && daySchedule != null ? (
				<DayScheduleTimeline
					blocks={daySchedule.blocks}
					createBlock={daySchedule.createBlock}
					error={daySchedule.error}
					isLoading={daySchedule.isLoading}
					localDateKey={dayPlan.localDateKey}
					updateBlock={daySchedule.updateBlock}
				/>
			) : null}

			{dayPlan == null ? (
				<div
					className="w-full rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm"
					data-testid="plan-dnia-guest-empty"
				>
					{/* Guest exception (PRD OQ #1): schedule is auth-only — no calendar tease. */}
					<p className="text-sm text-text-secondary">{t("guestEmpty")}</p>
				</div>
			) : dayPlan.isLoading ? (
				<p className="text-sm text-text-dimmed" data-testid="plan-dnia-loading">
					{t("loading")}
				</p>
			) : !dayPlan.hasBudget ? (
				<FocusBudgetPrompt
					hasBudget={dayPlan.hasBudget}
					isLoading={dayPlan.isLoading}
					isSettingBudget={dayPlan.isSettingBudget}
					localDateKey={dayPlan.localDateKey}
					onSetBudget={dayPlan.setBudget}
				/>
			) : (
				<BudgetPanel dayPlan={dayPlan} />
			)}

			{dayPlan != null && !dayPlan.isLoading && <DelegationSuggestionSection />}
		</div>
	);
}
