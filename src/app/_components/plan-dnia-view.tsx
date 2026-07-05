"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { FocusBudgetPrompt } from "~/app/_components/focus-budget-prompt";
import type { useDayPlan } from "~/hooks/use-day-plan";
import { formatFocusMinutes } from "~/lib/time/format-focus-minutes";

const PRESET_HOURS_MINUTES = [120, 240, 360] as const;

type PlanDniaViewProps = {
	dayPlan: ReturnType<typeof useDayPlan> | undefined;
};

export function PlanDniaView({ dayPlan }: PlanDniaViewProps) {
	const t = useTranslations("PlanDnia");
	const [editing, setEditing] = useState(false);
	const [customMinutes, setCustomMinutes] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSetBudget = useCallback(
		async (minutes: number) => {
			if (dayPlan == null) {
				return;
			}
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
		<div className="w-full max-w-lg space-y-4" data-testid="plan-dnia-view">
			<div>
				<h2 className="font-semibold text-lg text-text-section">
					{t("title")}
				</h2>
				<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
			</div>

			{dayPlan == null ? (
				<div
					className="w-full rounded-lg border border-border-subtle bg-surface-panel px-4 py-3"
					data-testid="plan-dnia-guest-empty"
				>
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
				<div
					className="w-full rounded-lg border border-border-subtle bg-surface-panel px-4 py-3"
					data-testid="plan-dnia-summary"
				>
					<p className="font-medium text-primary text-sm">
						{t("budgetHeading")}
					</p>
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
									disabled={
										dayPlan.isSettingBudget || customMinutes.trim() === ""
									}
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
			)}
		</div>
	);
}
