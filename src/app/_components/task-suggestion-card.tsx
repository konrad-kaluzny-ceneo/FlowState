"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
	OverlayCard,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import type { CommitmentHorizon } from "~/lib/data-mode/types";
import {
	getWorkTypeLabel,
	WORK_TYPE_CONFIG,
} from "~/lib/design/work-type-config";
import type { UserLocale } from "~/lib/domain/user-locale";
import type { RationaleBreakdown } from "~/lib/scoring/rationale-breakdown";

const SUGGESTION_HEADING_ID = "task-suggestion-heading";
const SUGGESTION_RATIONALE_PANEL_ID = "task-suggestion-rationale-panel";

function getSuggestionStatusMessage(
	props: TaskSuggestionCardProps,
	showSlowMessage: boolean,
	t: ReturnType<typeof useTranslations<"Suggestion">>,
): string {
	switch (props.status) {
		case "loading":
			return showSlowMessage ? t("statusSlow") : t("statusLoading");
		case "ready":
			return t("statusReady", { title: props.suggestion.title });
		case "empty":
			return t("statusEmpty");
		case "error":
			return t("statusError");
	}
}

export type TaskSuggestionData = {
	taskId: number;
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	importance?: 1 | 2 | 3;
	commitmentHorizon?: CommitmentHorizon;
	rationale: string;
	resumeNote?: string | null;
	breakdown?: RationaleBreakdown;
};

function hasBreakdownContent(breakdown?: RationaleBreakdown): boolean {
	if (breakdown == null) {
		return false;
	}
	return breakdown.dominant.length > 0 || breakdown.alsoConsidered.length > 0;
}

type TaskSuggestionCardProps =
	| {
			status: "loading";
			onAccept?: never;
			onRetry?: never;
			isAccepting?: never;
	  }
	| {
			status: "ready";
			suggestion: TaskSuggestionData;
			onAccept: () => void;
			onRetry?: never;
			isAccepting?: boolean;
			coachLine?: string;
	  }
	| {
			status: "empty";
			onAccept?: never;
			onRetry?: never;
			isAccepting?: never;
	  }
	| {
			status: "error";
			onAccept?: never;
			onRetry: () => void;
			isAccepting?: never;
	  };

function TaskBadges({
	suggestion,
	locale,
	t,
}: {
	suggestion: TaskSuggestionData;
	locale: UserLocale;
	t: ReturnType<typeof useTranslations<"Suggestion">>;
}) {
	const config = WORK_TYPE_CONFIG[suggestion.workType];
	const urgency = suggestion.urgency ?? suggestion.weight;
	const importance = suggestion.importance ?? 2;
	const weightLabel = (level: 1 | 2 | 3) => {
		if (level === 1) return t("weightLight");
		if (level === 2) return t("weightMedium");
		return t("weightHeavy");
	};
	return (
		<span className="flex flex-wrap items-center gap-1">
			<span
				className={`rounded-full px-2 py-0.5 font-medium text-xs ${config.bg} ${config.text}`}
			>
				{getWorkTypeLabel(suggestion.workType, locale)}
			</span>
			<span className="rounded-full bg-surface-panel px-2 py-0.5 font-medium text-text-secondary text-xs">
				{t("urgencyPrefix")}
				{weightLabel(urgency)}
			</span>
			<span className="rounded-full bg-worktype-deep-bg px-2 py-0.5 font-medium text-worktype-deep-text text-xs">
				{t("importancePrefix")}
				{weightLabel(importance)}
			</span>
			{suggestion.commitmentHorizon === "ASAP" && (
				<span
					className="rounded-full bg-worktype-reactive-bg px-2 py-0.5 font-medium text-worktype-reactive-text text-xs"
					data-testid="suggestion-asap-badge"
				>
					{t("asap")}
				</span>
			)}
		</span>
	);
}

function ReadySuggestionContent({
	suggestion,
	onAccept,
	isAccepting,
	rationaleExpanded,
	onRationaleExpandedChange,
	locale,
	t,
}: {
	suggestion: TaskSuggestionData;
	onAccept: () => void;
	isAccepting?: boolean;
	rationaleExpanded: boolean;
	onRationaleExpandedChange: (expanded: boolean) => void;
	locale: UserLocale;
	t: ReturnType<typeof useTranslations<"Suggestion">>;
}) {
	const showExpander = hasBreakdownContent(suggestion.breakdown);
	const breakdown = suggestion.breakdown;

	return (
		<div className="mt-4 space-y-4">
			<div className="space-y-2">
				<p
					className="overflow-hidden whitespace-pre-wrap break-all font-medium text-primary"
					data-testid="suggestion-task-title"
				>
					{suggestion.title}
				</p>
				<TaskBadges locale={locale} suggestion={suggestion} t={t} />
			</div>
			{suggestion.resumeNote != null && suggestion.resumeNote.length > 0 && (
				<p
					className="text-sm text-text-dimmed italic"
					data-testid="suggestion-resume-note"
				>
					{t("resumeNote", { note: suggestion.resumeNote })}
				</p>
			)}
			<p className="text-sm text-text-secondary">{suggestion.rationale}</p>
			{showExpander && breakdown != null && (
				<div className="space-y-2">
					<button
						aria-controls={SUGGESTION_RATIONALE_PANEL_ID}
						aria-expanded={rationaleExpanded}
						className="text-sm text-text-dimmed underline-offset-2 transition hover:text-text-secondary hover:underline"
						data-testid="suggestion-rationale-toggle"
						onClick={() => onRationaleExpandedChange(!rationaleExpanded)}
						type="button"
					>
						{t("rationaleToggle")}
					</button>
					{rationaleExpanded && (
						<div
							className="space-y-2 rounded-lg border border-border-subtle bg-surface-panel p-3 text-sm text-text-dimmed"
							data-testid="suggestion-rationale-expander"
							id={SUGGESTION_RATIONALE_PANEL_ID}
						>
							{breakdown.dominant.length > 0 && (
								<ul className="list-disc space-y-1 pl-4">
									{breakdown.dominant.map((factor) => (
										<li key={factor.key}>{factor.copy}</li>
									))}
								</ul>
							)}
							{breakdown.alsoConsidered.length > 0 && (
								<div className="space-y-1">
									<p className="text-text-dimmed text-xs">
										{t("alsoConsidered")}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{breakdown.alsoConsidered.map((label) => (
											<span
												className="rounded-full bg-surface-panel px-2 py-0.5 text-text-dimmed text-xs"
												key={label}
											>
												{label}
											</span>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			)}
			<button
				className={overlayButtonClass.primaryFull}
				data-testid="suggestion-accept-btn"
				disabled={isAccepting}
				onClick={onAccept}
				type="button"
			>
				{isAccepting ? t("acceptPending") : t("acceptLabel")}
			</button>
		</div>
	);
}

export function TaskSuggestionCard(props: TaskSuggestionCardProps) {
	const locale = useLocale() as UserLocale;
	const t = useTranslations("Suggestion");
	const [showSkeleton, setShowSkeleton] = useState(false);
	const [showSlowMessage, setShowSlowMessage] = useState(false);
	const [rationaleExpanded, setRationaleExpanded] = useState(false);

	useEffect(() => {
		if (props.status !== "loading") {
			setShowSkeleton(false);
			setShowSlowMessage(false);
		}

		if (props.status !== "ready") {
			setRationaleExpanded(false);
		}

		if (props.status !== "loading") {
			return;
		}

		const skeletonTimer = setTimeout(() => setShowSkeleton(true), 300);
		const slowTimer = setTimeout(() => setShowSlowMessage(true), 1000);

		return () => {
			clearTimeout(skeletonTimer);
			clearTimeout(slowTimer);
		};
	}, [props.status]);

	const statusMessage = getSuggestionStatusMessage(props, showSlowMessage, t);

	return (
		<OverlayCard
			centered={false}
			maxWidth="lg"
			padding="p-6"
			variant="suggestion"
		>
			<section
				aria-labelledby={SUGGESTION_HEADING_ID}
				data-testid="task-suggestion-card"
			>
				<h2
					className="font-semibold text-lg text-primary"
					id={SUGGESTION_HEADING_ID}
				>
					{t("heading")}
				</h2>
				{props.status === "ready" && props.coachLine != null && (
					<p
						className="mt-1 text-accent-cta/70 text-xs"
						data-testid="suggestion-coach-line"
					>
						{props.coachLine}
					</p>
				)}

				{(props.status === "loading" ||
					props.status === "empty" ||
					props.status === "error" ||
					props.status === "ready") && (
					<div
						aria-atomic="true"
						aria-live="polite"
						className="mt-4"
						data-testid="suggestion-live-status"
					>
						{props.status === "loading" && (
							<div className="space-y-3">
								{showSkeleton ? (
									<>
										<div className="h-5 w-3/4 animate-pulse rounded bg-surface-panel" />
										<div className="h-4 w-full animate-pulse rounded bg-surface-panel" />
										<div className="h-10 w-full animate-pulse rounded-lg bg-surface-panel" />
									</>
								) : (
									<p className="text-sm text-text-dimmed">
										{t("statusLoading")}
									</p>
								)}
								{showSlowMessage && (
									<p className="text-sm text-text-secondary">
										{t("statusSlow")}
									</p>
								)}
							</div>
						)}

						{props.status === "ready" && (
							<p className="sr-only">{statusMessage}</p>
						)}

						{props.status === "empty" && (
							<p className="text-sm text-text-secondary">{t("statusEmpty")}</p>
						)}

						{props.status === "error" && (
							<p className="text-red-600 text-sm">{t("statusError")}</p>
						)}
					</div>
				)}

				{props.status === "ready" && (
					<ReadySuggestionContent
						isAccepting={props.isAccepting}
						locale={locale}
						onAccept={props.onAccept}
						onRationaleExpandedChange={setRationaleExpanded}
						rationaleExpanded={rationaleExpanded}
						suggestion={props.suggestion}
						t={t}
					/>
				)}

				{props.status === "error" && (
					<div className="mt-3">
						<button
							className={`${overlayButtonClass.secondaryFull} py-2 font-medium`}
							onClick={props.onRetry}
							type="button"
						>
							{t("retry")}
						</button>
					</div>
				)}
			</section>
		</OverlayCard>
	);
}
