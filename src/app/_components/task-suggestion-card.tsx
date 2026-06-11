"use client";

import { useEffect, useState } from "react";

import {
	OverlayCard,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import type { CommitmentHorizon } from "~/lib/data-mode/types";
import { WORK_TYPE_CONFIG } from "~/lib/design/work-type-config";
import type { RationaleBreakdown } from "~/lib/scoring/rationale-breakdown";

const WEIGHT_LABELS = { 1: "Light", 2: "Medium", 3: "Heavy" } as const;

export type TaskSuggestionData = {
	taskId: number;
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	importance?: 1 | 2 | 3;
	commitmentHorizon?: CommitmentHorizon;
	rationale: string;
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

function TaskBadges({ suggestion }: { suggestion: TaskSuggestionData }) {
	const config = WORK_TYPE_CONFIG[suggestion.workType];
	const urgency = suggestion.urgency ?? suggestion.weight;
	const importance = suggestion.importance ?? 2;
	return (
		<span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
			<span
				className={`rounded-full px-2 py-0.5 font-medium text-xs ${config.bg} ${config.text}`}
			>
				{config.label}
			</span>
			<span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/70 text-xs">
				U: {WEIGHT_LABELS[urgency]}
			</span>
			<span className="rounded-full bg-indigo-500/20 px-2 py-0.5 font-medium text-indigo-200 text-xs">
				I: {WEIGHT_LABELS[importance]}
			</span>
			{suggestion.commitmentHorizon === "ASAP" && (
				<span
					className="rounded-full bg-orange-500/25 px-2 py-0.5 font-medium text-orange-200 text-xs"
					data-testid="suggestion-asap-badge"
				>
					ASAP
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
}: {
	suggestion: TaskSuggestionData;
	onAccept: () => void;
	isAccepting?: boolean;
	rationaleExpanded: boolean;
	onRationaleExpandedChange: (expanded: boolean) => void;
}) {
	const showExpander = hasBreakdownContent(suggestion.breakdown);
	const breakdown = suggestion.breakdown;

	return (
		<div className="mt-4 space-y-4">
			<div className="flex items-start justify-between gap-3">
				<p className="font-medium text-white">{suggestion.title}</p>
				<TaskBadges suggestion={suggestion} />
			</div>
			<p className="text-sm text-white/60">{suggestion.rationale}</p>
			{showExpander && breakdown != null && (
				<div className="space-y-2">
					<button
						aria-expanded={rationaleExpanded}
						className="text-sm text-white/50 underline-offset-2 transition hover:text-white/70 hover:underline"
						data-testid="suggestion-rationale-toggle"
						onClick={() => onRationaleExpandedChange(!rationaleExpanded)}
						type="button"
					>
						Why this?
					</button>
					{rationaleExpanded && (
						<div
							className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/50"
							data-testid="suggestion-rationale-expander"
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
									<p className="text-white/40 text-xs">Also considered:</p>
									<div className="flex flex-wrap gap-1.5">
										{breakdown.alsoConsidered.map((label) => (
											<span
												className="rounded-full bg-white/10 px-2 py-0.5 text-white/50 text-xs"
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
				{isAccepting ? "Focusing…" : "Focus this"}
			</button>
		</div>
	);
}

export function TaskSuggestionCard(props: TaskSuggestionCardProps) {
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

	return (
		<OverlayCard
			centered={false}
			maxWidth="lg"
			padding="p-6"
			variant="suggestion"
		>
			<div data-testid="task-suggestion-card">
				<h2 className="font-bold text-lg text-white">Suggested next task</h2>
				{props.status === "ready" && props.coachLine != null && (
					<p
						className="mt-1 text-purple-200/70 text-xs"
						data-testid="suggestion-coach-line"
					>
						{props.coachLine}
					</p>
				)}

				{props.status === "loading" && (
					<div className="mt-4 space-y-3">
						{showSkeleton ? (
							<>
								<div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
								<div className="h-4 w-full animate-pulse rounded bg-white/10" />
								<div className="h-10 w-full animate-pulse rounded-lg bg-white/10" />
							</>
						) : (
							<p className="text-sm text-white/50">Finding a good match…</p>
						)}
						{showSlowMessage && (
							<p className="text-sm text-white/60">Still working on it…</p>
						)}
					</div>
				)}

				{props.status === "ready" && (
					<ReadySuggestionContent
						isAccepting={props.isAccepting}
						onAccept={props.onAccept}
						onRationaleExpandedChange={setRationaleExpanded}
						rationaleExpanded={rationaleExpanded}
						suggestion={props.suggestion}
					/>
				)}

				{props.status === "empty" && (
					<p className="mt-4 text-sm text-white/60">
						No active tasks — add one or end session.
					</p>
				)}

				{props.status === "error" && (
					<div className="mt-4 space-y-3">
						<p className="text-red-200/80 text-sm">
							Could not load a suggestion. Your break is still running.
						</p>
						<button
							className={`${overlayButtonClass.secondaryFull} py-2 font-medium`}
							onClick={props.onRetry}
							type="button"
						>
							Retry
						</button>
					</div>
				)}
			</div>
		</OverlayCard>
	);
}
